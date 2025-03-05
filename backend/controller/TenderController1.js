// backend/controllers/tenderController.js
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

// Tender status mapping for database
const statusMap = {
  0: 'OPEN',
  1: 'UNDER_REVIEW',
  2: 'AWARDED',
  3: 'COMPLETED',
  4: 'CANCELLED'
};

// Create a new tender
export const createTender = async (req, res) => {
  try {
    const { title, description, budget, deadline, documents } = req.body;
    const userId = req.user.id; // Assuming authentication middleware sets this
    
    // Validate input
    if (!title || !description || !budget || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Upload documents to IPFS
    const ipfsHash = await uploadToIPFS(documents);
    
    // Convert deadline to timestamp
    const deadlineTimestamp = Math.floor(new Date(deadline).getTime() / 1000);
    
    // Convert budget to Wei
    const budgetInWei = ethers.parseEther(budget.toString());
    
    // Create tender on blockchain
    const tx = await contract.createTender(
      title,
      description,
      budgetInWei,
      deadlineTimestamp,
      ipfsHash
    );
    
    const receipt = await tx.wait();
    
    // Extract tender ID from event logs
    const event = receipt.logs
      .filter(log => contract.interface.parseLog(log).name === 'TenderCreated')
      .map(log => contract.interface.parseLog(log))[0];
    
    const tenderId = event.args.tenderId;
    
    // Store in PostgreSQL
    const result = await pool.query(
      `INSERT INTO tenders (
        blockchain_id, title, description, budget, deadline, 
        ipfs_hash, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        tenderId.toString(),
        title,
        description,
        budget,
        new Date(deadline),
        ipfsHash,
        'OPEN',
        userId
      ]
    );
    
    const dbTenderId = result.rows[0].id;
    
    // Log successful creation
    logger.info(`Tender created: ID ${dbTenderId}, Blockchain ID ${tenderId}`);
    
    // Notify relevant stakeholders
    await sendNotification('NEW_TENDER', {
      tenderId: dbTenderId,
      title,
      budget,
      deadline
    });
    
    res.status(201).json({ 
      id: dbTenderId,
      blockchainId: tenderId.toString(),
      message: 'Tender created successfully', 
      ipfsHash 
    });
  } catch (error) {
    logger.error('Error creating tender:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all tenders with optional filters
export const getTenders = async (req, res) => {
  try {
    const { status, minBudget, maxBudget, search } = req.query;
    
    let query = 'SELECT * FROM tenders WHERE 1=1';
    const params = [];
    let paramCount = 1;
    
    // Apply filters
    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    if (minBudget) {
      query += ` AND budget >= $${paramCount}`;
      params.push(minBudget);
      paramCount++;
    }
    
    if (maxBudget) {
      query += ` AND budget <= $${paramCount}`;
      params.push(maxBudget);
      paramCount++;
    }
    
    if (search) {
      query += ` AND (title ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.status(200).json(result.rows);
  } catch (error) {
    logger.error('Error getting tenders:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get a single tender by ID with its bids
export const getTenderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get tender from database
    const tenderResult = await pool.query(
      'SELECT * FROM tenders WHERE id = $1',
      [id]
    );
    
    if (tenderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tender not found' });
    }
    
    const tender = tenderResult.rows[0];
    
    // Get bids for this tender
    const bidsResult = await pool.query(
      'SELECT * FROM bids WHERE tender_id = $1 ORDER BY created_at DESC',
      [id]
    );
    
    // Get blockchain data for additional verification
    const blockchainTender = await contract.getTender(tender.blockchain_id);
    
    res.status(200).json({
      ...tender,
      blockchainDetails: {
        id: blockchainTender.id.toString(),
        creator: blockchainTender.creator,
        status: statusMap[blockchainTender.status]
      },
      bids: bidsResult.rows
    });
  } catch (error) {
    logger.error(`Error getting tender ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
};

// Update tender status
export const updateTenderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Get blockchain ID from database
    const result = await pool.query(
      'SELECT blockchain_id FROM tenders WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tender not found' });
    }
    
    const blockchainId = result.rows[0].blockchain_id;
    
    // Map status string to enum value
    const statusMap = {
      'OPEN': 0,
      'UNDER_REVIEW': 1,
      'AWARDED': 2,
      'COMPLETED': 3,
      'CANCELLED': 4
    };
    
    // Update on blockchain
    if (status === 'COMPLETED') {
      const tx = await contract.completeTender(blockchainId);
      await tx.wait();
    } else if (status === 'CANCELLED') {
      const tx = await contract.cancelTender(blockchainId);
      await tx.wait();
    } else {
      const tx = await contract.updateTenderStatus(blockchainId, statusMap[status]);
      await tx.wait();
    }
    
    // Update in database
    await pool.query(
      'UPDATE tenders SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, id]
    );
    
    // Send notifications based on new status
    await sendNotification(`TENDER_${status}`, {
      tenderId: id
    });
    
    res.status(200).json({ message: `Tender status updated to ${status}` });
  } catch (error) {
    logger.error(`Error updating tender ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
};

// Complete a tender
export const completeTender = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get blockchain ID from database
    const result = await pool.query(
      'SELECT blockchain_id FROM tenders WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tender not found' });
    }
    
    const blockchainId = result.rows[0].blockchain_id;
    
    // Mark tender as completed on blockchain
    const tx = await contract.completeTender(blockchainId);
    await tx.wait();
    
    // Update database
    await pool.query(
      'UPDATE tenders SET status = $1, updated_at = NOW() WHERE id = $2',
      ['COMPLETED', id]
    );
    
    // Notify stakeholders
    await sendNotification('TENDER_COMPLETED', {
      tenderId: id
    });
    
    res.status(200).json({ message: 'Tender marked as completed' });
  } catch (error) {
    logger.error(`Error completing tender ${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
};