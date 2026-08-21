import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/requireRole';

const router = Router();

// Public login route
router.post('/login', AuthController.login);

// Protected current user profile route
router.get('/me', authenticate, AuthController.getMe);

// Protected admin-only smoke test route
router.get('/admin-only', authenticate, requireRole(['ADMIN']), AuthController.adminOnly);

export default router;
