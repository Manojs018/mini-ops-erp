import bcrypt from 'bcryptjs';
import { prisma } from '../../config/prisma';
import { signToken } from '../../utils/jwt';
import { AppError } from '../../utils/errors';

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  locationId: string | null;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}

export class AuthService {
  /**
   * Authenticates user via email and password, returning signed JWT and sanitized user profile.
   */
  static async login(email?: string, password?: string): Promise<LoginResponse> {
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new AppError('Email and password are required', 400);
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      throw new AppError('Email and password are required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new AppError('Invalid email format', 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = signToken({
      userId: user.id,
      role: user.role,
      locationId: user.locationId,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        locationId: user.locationId,
      },
    };
  }

  /**
   * Fetches profile of the currently authenticated user by userId.
   */
  static async getMe(userId: string): Promise<UserResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
    };
  }
}
