import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Mini Operations ERP Backend API' });
});

// Mount module routes
app.use('/auth', authRoutes);
app.use('/inventory', inventoryRoutes);

// Centralized Error Handler
app.use(errorHandler);

export default app;
