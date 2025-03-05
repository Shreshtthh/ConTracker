// backend/app.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import tenderRoutes from './routes/tenderRoutes.js';

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/tenders', tenderRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
