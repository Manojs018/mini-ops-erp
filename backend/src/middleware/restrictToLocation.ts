import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

/**
 * Higher-order middleware to enforce location-restricted access for non-ADMIN users.
 *
 * Usage Example:
 * ```typescript
 * router.get(
 *   '/:id',
 *   authenticate,
 *   restrictToLocation(async (req) => {
 *     const stock = await InventoryService.getInventoryById(req.params.id);
 *     return stock ? stock.locationId : null;
 *   }),
 *   InventoryController.getById
 * );
 * ```
 *
 * Design Decisions:
 * 1. ADMIN role users ALWAYS bypass location restrictions (unrestricted access across all locations).
 * 2. Non-ADMIN users with `user.locationId === null` are treated as unrestricted global managers.
 * 3. If `getResourceLocationId` returns `null` (resource missing or deleted), calls `next()` to allow standard 404 handlers downstream.
 * 4. Non-ADMIN users attempting to read/modify resources at locations other than `user.locationId` receive `403 Forbidden`.
 */
export function restrictToLocation(
  getResourceLocationId: (req: Request) => Promise<string | null>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          error: {
            message: 'Authentication required',
            statusCode: 401,
          },
        });
        return;
      }

      // Rule 1: ADMIN users always bypass location restriction
      if (user.role === Role.ADMIN) {
        next();
        return;
      }

      // Rule 2: Non-ADMIN users without an assigned locationId are unrestricted
      if (!user.locationId) {
        next();
        return;
      }

      // Resolve locationId of the target resource
      const resourceLocationId = await getResourceLocationId(req);

      // Rule 3: If target resource has no location or doesn't exist, let 404 handlers handle it
      if (!resourceLocationId) {
        next();
        return;
      }

      // Rule 4: Enforce location match
      if (resourceLocationId !== user.locationId) {
        res.status(403).json({
          error: {
            message: 'You are restricted to your assigned location',
            statusCode: 403,
          },
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
