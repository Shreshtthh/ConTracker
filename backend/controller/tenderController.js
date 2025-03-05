
import { ethers } from 'ethers';
import TenderContract from '../contracts/TenderContract.json';
import pool from '../db.js';

const provider = new ethers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, TenderContract.abi, wallet);

export const createTender = async (req, res) => {
    try {
        const { title, description, budget } = req.body;
        
        const tx = await contract.createTender(title, ethers.parseEther(budget));
        await tx.wait();

        await pool.query('INSERT INTO tenders (title, description, budget) VALUES ($1, $2, $3)',
                         [title, description, budget]);

        res.status(201).json({ message: 'Tender created successfully!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getTenders = async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tenders');
        res.status(200).json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
