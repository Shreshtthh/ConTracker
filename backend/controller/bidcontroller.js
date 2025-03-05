// backend/controllers/bidController.js
import { ethers } from 'ethers';
import TenderContract from '../contracts/TenderContract.json';
import pool from '../db.js';
import { uploadToIPFS } from '../services/ipfsService.js';
import { sendNotification } from '../services/notificationService.js';
import { logger } from '../utils/logger.js';

// Blockchain setup
const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, TenderContract.abi, wallet);

// Bid status mapping
const bidStatusMap = {
  0: 'SUBMITTED',
  1: 'UNDER_REVIEW',
  2: 'ACCEPTED',
  3: 'REJECTED'
};

// Submit a bid for a tender
export const submitBid = async (req, res) => {
  try {
    const { tenderId } = req.params;
    const { amount, description, proposedTimeline, documents } = req.body;
    const bidderId = req.user.id; // From authentication middleware
    
    // Validate input
    if (!amount || !description || !proposedTimeline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get tender details from database
    const tenderResult = await pool.query(
      'SELECT blockchain_id, status FROM tenders WHERE id = $1',
      [tenderId]
    );
    
    if (tenderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tender not found' });
    }
    
    const tender = tenderResult.rows[0];
    
    // Check if tender is open for bidding
    if (tender.status !== 'OPEN') {
      return res.status(400).json({ error: 'Tender is not open for bidding' });
    }
    
    // Upload bid documents to IPFS
    const ipfsHash = await uploadToIPFS(documents);
    
    // Convert amount to Wei
    const amountInWei = ethers.parseEther(amount.toString());
    
    // Submit bid on blockchain
    const tx = await contract.submitBid(
      tender.blockchain_id,
      amountInWei,
      description,
      proposedTimeline,
      ipfsHash
    );
    
    const receipt = await tx.wait();
    
    // Extract bid ID from event logs
    const event = receipt.logs
      .filter(log => contract.interface.parseLog(log).name === 'BidSubmitted')
      .map(log => contract.interface.parseLog(log))[0];
    
    const blockchainBidId = event.args.bidId;
    
    // Store in PostgreSQL
    const result = await pool.query(
      `INSERT INTO bids (
        blockchain_id, tender_id, bidder_id, amount, description, 
        proposed_timeline, ipfs_hash, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        blockchainBidId.toString(),
        tenderId,
        bidderId,
        amount,
        description,
        proposedTimeline,
        ipfsHash,
        'SUBMITTED'
      ]
    );
    
    const dbBidId = result.rows[0].id;
    
    // Log successful bid
    logger.info(`Bid submitted: ID ${dbBidId}, Blockchain ID ${blockchainBidId}, Tender ID ${tenderId}`);
    
    // Notify tender owner
    await sendNotification('NEW_BID', {
      tenderId,
      bidId: dbBidId
    });
    
    res.status(201).json({ 
      id: dbBidId,
      blockchainId: blockchainBidId.toString(),
      message: 'Bid submitted successfully'
    });
  } catch (error) {
    logger.error(`Error submitting bid for tender ${req.params.tenderId}:`, error);
    res.status(500).json({ error: error.message });
  }
};

// Get all bids for a tender
export const getTenderBids = async (req, res) => {
  try {
    const { tenderId } = req.params;
    
    // Check if tender exists
    const tenderResult = await pool.query(
      'SELECT * FROM tenders WHERE id = $1',
      [tenderId]
    );
    
    if (tenderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tender not found' });
    }
    
    // Get bids from database
    const result = await pool.query(
      `SELECT b.*, u.name as bidder_name, u.email as bidder_email 
       FROM bids b
       JOIN users u ON b.bidder_id = u.id
       WHERE b.tender_id = $1
       ORDER BY b.created_at DESC`,
      [tenderId]
    );
    
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting bids for tender ${req.params.tenderId}:`, error);
    res.status(500).json({ error: error.message });
  }
};

// Get bids submitted by a user
export const getUserBids = async (req, res) => {
  try {
    const userId = req.user.id; // From authentication middleware
    
    const result = await pool.query(
      `SELECT b.*, t.title as tender_title, t.status as tender_status 
       FROM bids b
       JOIN tenders t ON b.tender_id = t.id
       WHERE b.bidder_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    );
    
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error(`Error getting bids for user ${req.user.id}:`, error);
    res.status(500).json({ error: error.message });
  }
};

// Update bid status
export const updateBidStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Get blockchain ID from database
    const result = await pool.query(
      'SELECT blockchain_id, tender_id FROM bids WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bid not found' });
    }
    
    const { blockchain_id, tender_id } = result.rows[0];
    
    // Map status string to enum value
    const statusMap = {
      'SUBMITTED': 0,
      'UNDER_REVIEW': 1,
      'ACCEPTED': 2,
      'REJECTED': 3
    };
    
    // Update on blockchain
    const tx = await contract.updateBidStatus(blockchain_id, statusMap[status]);
    await tx.wait();
    
    // Update in database
    await pool.query(
      'UPDATE bids SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
    
    // If bid is accepted, update tender status
    if (status === 'ACCEPTED') {
      await pool.query(
        'UPDATE tenders SET status = $1, selected_bid_id = $2, updated_at = NOW() WHERE id = $3',
        ['AWARDED', id, tender_id]
      );
      
      // Reject all other bids for this tender
      await pool.query(
        'UPDATE bids SET status = $1, updated_at = NOW() WHERE tender_id = $2 AND id != $3',
        ['REJECTED', tender_id, id]
      );
    }
    
    // Send notifications
    await sendNotification(`BID_${status}`, {
      bidId: id,
      tenderId: tender_id
    });
    
    res.status(200).json({ message: `Bid status updated to ${status}` });
  } catch (error) {
    logger.error(`Error updating bid ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
};