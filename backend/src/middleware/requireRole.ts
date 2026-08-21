import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from '../utils/errors';

/**
 * Higher-order middleware function to restrict access based on user roles.
 * Must run AFTER the `authenticate` middleware in the request handler chain.
 *
 * @param allowedRoles Array of roles authorized to access the route (e.g. ['ADMIN', 'OPERATIONS'])
 * @returns Express middleware function
 *
 * @example
 * // Restrict route to ADMIN users only
 * router.get('/admin-only', authenticate, requireRole(['ADMIN']), controllerAction);
 *
 * @example
 * // Restrict route to ADMIN and OPERATIONS users
 * router.post('/transfers', authenticate, requireRole(['ADMIN', 'OPERATIONS']), createTransfer);
 */
export const requireRole = (allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('No authentication token provided', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }

    next();
  };
};
