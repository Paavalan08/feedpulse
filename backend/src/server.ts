import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from './config/db';
import feedbackRoutes from './routes/feedbackRoutes';
import authRoutes from './routes/authRoutes';
import { ensureDefaultAdminUser } from './services/adminUser.service';

// Load environment variables
dotenv.config();

// Initialize Express
const app: Application = express();

// Connect to MongoDB Atlas
connectDB();
mongoose.connection.once('open', async () => {
  try {
    await ensureDefaultAdminUser();
  } catch (error) {
    console.error('Failed to ensure default admin user', error);
  }
});

// Middleware
app.use(cors()); // Allows your Next.js frontend to communicate with this API
app.use(express.json()); // Allows the server to accept JSON data in the request body

// Mount Routes
app.use('/api/feedback', feedbackRoutes);
app.use('/api/auth', authRoutes);

// Basic Health Check Route
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ 
    success: true, 
    message: 'FeedPulse API is running smoothly.' 
  });
});

// Define the Port
const PORT = process.env.PORT || 4000;

// Start the Server
app.listen(PORT, () => {
  console.log(`Server is running in development mode on port ${PORT}`);
});