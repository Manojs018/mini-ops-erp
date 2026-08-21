import { Router } from 'express';
import { WorkOrderController } from './work-order.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';

const router = Router();

// Read endpoints accessible by ADMIN, OPERATIONS, SALES
router.get('/', authenticate, requireRole(['ADMIN', 'OPERATIONS', 'SALES']), WorkOrderController.list);
router.get('/:id', authenticate, requireRole(['ADMIN', 'OPERATIONS', 'SALES']), WorkOrderController.getById);
router.get('/:id/stock-check', authenticate, requireRole(['ADMIN', 'OPERATIONS', 'SALES']), WorkOrderController.getStockCheck);

// Creation endpoint restricted to ADMIN only
router.post('/', authenticate, requireRole(['ADMIN']), WorkOrderController.create);

// Status update endpoint restricted to ADMIN and OPERATIONS
router.patch('/:id/status', authenticate, requireRole(['ADMIN', 'OPERATIONS']), WorkOrderController.updateStatus);

export default router;
