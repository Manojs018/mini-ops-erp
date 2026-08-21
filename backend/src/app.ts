import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import workOrderRoutes from './modules/work-orders/work-order.routes';
import transferRoutes from './modules/transfers/transfer.routes';
import orderRoutes from './modules/orders/order.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();

// Enable CORS for frontend integration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-idempotency-key'],
  })
);

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Mini Operations ERP Backend API' });
});

// Mount module routes
app.use('/auth', authRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/work-orders', workOrderRoutes);
app.use('/transfers', transferRoutes);
app.use('/orders', orderRoutes);

// Centralized Error Handler
app.use(errorHandler);

export default app;
