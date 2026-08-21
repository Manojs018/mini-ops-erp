import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AppError } from '../../utils/errors';

export class AuthController {
  /**
   * POST /auth/login
   */
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/me
   */
  static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('No authentication token provided', 401);
      }
      const user = await AuthService.getMe(req.user.userId);
      res.status(200).json({ user });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /auth/admin-only (Smoke test route protected by ADMIN role)
   */
  static async adminOnly(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({
        message: 'Admin access granted',
        user: req.user,
      });
    } catch (error) {
      next(error);
    }
  }
}
