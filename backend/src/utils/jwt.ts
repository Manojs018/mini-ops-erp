import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types/express';

const JWT_EXPIRES_IN = '8h';

/**
 * Signs a JWT access token containing { userId, role, locationId } with 8h expiration.
 */
export const signToken = (payload: JwtPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }
  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verifies a JWT access token using process.env.JWT_SECRET.
 * Throws an error if invalid or expired.
 */
export const verifyToken = (token: string): JwtPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined');
  }
  return jwt.verify(token, secret) as JwtPayload;
};
