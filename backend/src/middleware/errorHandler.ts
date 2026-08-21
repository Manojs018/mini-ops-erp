import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

/**
 * Centralized Express error handler middleware.
 * Returns consistent JSON response shape: { error: { message, statusCode } }
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode === 500) {
    console.error('Unhandled Error:', err);
  }

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
    },
  });
};
