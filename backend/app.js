// backend/app.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import citizenRouter from './routes/citizen.routes.js';
import adminRoutes from './routes/admin.routes.js'
import ownerRoutes from './routes/owner.routes.js'
import cookieParser from 'cookie-parser';
// import tenderRoutes from './routes/tenderRoutes.js';

dotenv.config();
const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))
app.use(cookieParser());

app.use(express.json({limit:'16kb'}));
app.use(express.urlencoded({extended:true, limit:"16kb"})) // to encode the url of the various browser
app.use(express.static("public")) //to store the components in the server
// app.use('/api/tenders', tenderRoutes);

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

app.use('/api/citizens',citizenRouter)
app.use('/api/admins',adminRoutes)
app.use('/api/owners',ownerRoutes)

export {app};
