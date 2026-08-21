import { Router } from 'express';
import { OrderController } from './order.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';

const router = Router();

// Read endpoints accessible by ADMIN, OPERATIONS, SALES
router.get('/', authenticate, requireRole(['ADMIN', 'OPERATIONS', 'SALES']), OrderController.list);
router.get('/:id', authenticate, requireRole(['ADMIN', 'OPERATIONS', 'SALES']), OrderController.getById);

// Create order restricted to SALES role only
router.post('/', authenticate, requireRole(['SALES']), OrderController.create);

// Cancel order restricted to SALES (own orders) and ADMIN (any order)
router.patch('/:id/cancel', authenticate, requireRole(['ADMIN', 'SALES']), OrderController.cancel);

export default router;
