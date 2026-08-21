import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { restrictToLocation } from './restrictToLocation';

describe('restrictToLocation Middleware Unit Tests', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      params: {},
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('should call next() for ADMIN role regardless of locationId or resource location', async () => {
    req.user = {
      userId: 'admin-1',
      role: Role.ADMIN,
      locationId: 'loc-1',
    };

    const getResourceLoc = jest.fn().mockResolvedValue('loc-2'); // Different location
    const middleware = restrictToLocation(getResourceLoc);

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(getResourceLoc).not.toHaveBeenCalled(); // ADMIN short-circuits before resolving
  });

  it('should call next() for non-ADMIN role if user locationId matches resource locationId', async () => {
    req.user = {
      userId: 'ops-1',
      role: Role.OPERATIONS,
      locationId: 'loc-alpha',
    };

    const getResourceLoc = jest.fn().mockResolvedValue('loc-alpha'); // Matching location
    const middleware = restrictToLocation(getResourceLoc);

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 403 Forbidden if non-ADMIN user locationId does NOT match resource locationId', async () => {
    req.user = {
      userId: 'ops-1',
      role: Role.OPERATIONS,
      locationId: 'loc-alpha',
    };

    const getResourceLoc = jest.fn().mockResolvedValue('loc-bravo'); // Mismatched location
    const middleware = restrictToLocation(getResourceLoc);

    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'You are restricted to your assigned location',
        statusCode: 403,
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() if non-ADMIN user has null locationId (unrestricted user record)', async () => {
    req.user = {
      userId: 'ops-global',
      role: Role.OPERATIONS,
      locationId: undefined,
    };

    const getResourceLoc = jest.fn().mockResolvedValue('loc-bravo');
    const middleware = restrictToLocation(getResourceLoc);

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() if getResourceLocationId resolves to null (resource missing or un-scoped)', async () => {
    req.user = {
      userId: 'ops-1',
      role: Role.OPERATIONS,
      locationId: 'loc-alpha',
    };

    const getResourceLoc = jest.fn().mockResolvedValue(null); // Resource not found
    const middleware = restrictToLocation(getResourceLoc);

    await middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 Unauthorized if req.user is undefined', async () => {
    req.user = undefined;

    const getResourceLoc = jest.fn().mockResolvedValue('loc-alpha');
    const middleware = restrictToLocation(getResourceLoc);

    await middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        message: 'Authentication required',
        statusCode: 401,
      },
    });
    expect(next).not.toHaveBeenCalled();
  });
});
