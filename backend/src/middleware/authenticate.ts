import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from '../utils/errors';

/**
 * Middleware to authenticate requests via JWT Bearer token in Authorization header.
 * Attaches decoded JwtPayload { userId, role, locationId } to req.user on success.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('No authentication token provided', 401));
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return next(new AppError('No authentication token provided', 401));
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return next(new AppError('Invalid or expired token', 401));
  }
};
