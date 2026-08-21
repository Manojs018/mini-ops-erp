import { Role } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  role: Role;
  locationId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
