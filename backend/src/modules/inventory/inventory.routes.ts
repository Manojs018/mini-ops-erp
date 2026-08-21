import { Router } from 'express';
import { InventoryController } from './inventory.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';

const router = Router();

// Read endpoints accessible by ADMIN, OPERATIONS, SALES
router.get('/', authenticate, requireRole(['ADMIN', 'OPERATIONS', 'SALES']), InventoryController.list);
router.get('/:id', authenticate, requireRole(['ADMIN', 'OPERATIONS', 'SALES']), InventoryController.getById);

// Write endpoints restricted to ADMIN and OPERATIONS
router.post('/', authenticate, requireRole(['ADMIN', 'OPERATIONS']), InventoryController.create);
router.patch('/:id/adjust', authenticate, requireRole(['ADMIN', 'OPERATIONS']), InventoryController.adjust);
router.post('/:id/report-damage', authenticate, requireRole(['ADMIN', 'OPERATIONS']), InventoryController.reportDamage);

export default router;
