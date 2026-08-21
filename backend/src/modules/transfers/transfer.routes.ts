import { Router } from 'express';
import { TransferController } from './transfer.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';

const router = Router();

// Read endpoints accessible by ADMIN, OPERATIONS, SALES
router.get('/', authenticate, requireRole(['ADMIN', 'OPERATIONS', 'SALES']), TransferController.list);
router.get('/:id', authenticate, requireRole(['ADMIN', 'OPERATIONS', 'SALES']), TransferController.getById);

// Transfer request endpoint restricted to ADMIN and OPERATIONS
router.post('/', authenticate, requireRole(['ADMIN', 'OPERATIONS']), TransferController.create);

// Dispatch and Receive endpoints restricted to ADMIN and OPERATIONS
router.patch('/:id/dispatch', authenticate, requireRole(['ADMIN', 'OPERATIONS']), TransferController.dispatch);
router.patch('/:id/receive', authenticate, requireRole(['ADMIN', 'OPERATIONS']), TransferController.receive);

export default router;
