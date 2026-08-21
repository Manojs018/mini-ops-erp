import { InventoryService } from './inventory.service';
import { prisma } from '../../config/prisma';
import { InsufficientStockError } from '../../utils/errors';
import { ReferenceType } from '@prisma/client';
import { randomUUID } from 'crypto';

// Mock Prisma Client for concurrency simulation
jest.mock('../../config/prisma', () => ({
  prisma: {
    inventoryStock: {
      findUnique: jest.fn(),
    },
    inventoryTransaction: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

describe('Inventory Concurrency Engine Race-Condition Tests', () => {
  let simulatedReservedQty = 0;
  const physicalQty = 100;
  const stockId = 'concurrency-stock-id-1';

  beforeEach(() => {
    simulatedReservedQty = 0;
    jest.clearAllMocks();

    // Mock Prisma findUnique for idempotency check (returns null so reservation executes)
    (prisma.inventoryTransaction.findUnique as jest.Mock).mockResolvedValue(null);

    // Mock getInventoryById to return simulated stock state
    (prisma.inventoryStock.findUnique as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        id: stockId,
        itemId: 'item-1',
        locationId: 'loc-1',
        batch: 'BATCH-CONCURRENCY',
        physicalQty,
        reservedQty: simulatedReservedQty,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        item: { id: 'item-1', name: 'Test Item', sku: 'SKU-TEST' },
        location: { id: 'loc-1', name: 'Test Location' },
      })
    );

    // Mock $queryRaw to simulate PostgreSQL atomic conditional update:
    // UPDATE ... WHERE ("physicalQty" - "reservedQty") >= quantity
    (prisma.$queryRaw as jest.Mock).mockImplementation((strings: TemplateStringsArray, ...values: any[]) => {
      const quantity = values[0];
      const available = physicalQty - simulatedReservedQty;

      if (available >= quantity) {
        simulatedReservedQty += quantity;
        return Promise.resolve([
          {
            id: stockId,
            physicalQty,
            reservedQty: simulatedReservedQty,
          },
        ]);
      } else {
        // Atomic update matched 0 rows due to insufficient available stock
        return Promise.resolve([]);
      }
    });

    (prisma.inventoryTransaction.create as jest.Mock).mockResolvedValue({ id: 'tx-id' });
  });

  it('should handle concurrent reservation requests race-condition safely across 5 loop iterations', async () => {
    const NUM_ITERATIONS = 5;

    for (let iteration = 1; iteration <= NUM_ITERATIONS; iteration++) {
      // Reset stock state before each iteration
      simulatedReservedQty = 0;

      const reqA = InventoryService.reserveStock(
        stockId,
        80,
        ReferenceType.ORDER,
        `ORD-A-${iteration}`,
        `idempotency-key-A-${iteration}-${randomUUID()}`
      );

      const reqB = InventoryService.reserveStock(
        stockId,
        50,
        ReferenceType.ORDER,
        `ORD-B-${iteration}`,
        `idempotency-key-B-${iteration}-${randomUUID()}`
      );

      // Fire concurrent requests using Promise.allSettled
      const results = await Promise.allSettled([reqA, reqB]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // 1. Exactly ONE reservation must succeed
      expect(fulfilled).toHaveLength(1);

      // 2. Exactly ONE reservation must be rejected with InsufficientStockError
      expect(rejected).toHaveLength(1);
      const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedError).toBeInstanceOf(InsufficientStockError);

      // 3. Final reservedQty must be strictly 80 or 50 (never 130)
      expect(simulatedReservedQty === 80 || simulatedReservedQty === 50).toBe(true);
    }
  });
});
