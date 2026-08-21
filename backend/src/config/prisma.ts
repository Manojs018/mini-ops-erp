import { PrismaClient } from '@prisma/client';
import { mockPrisma } from './mockDb';

let prismaInstance: any;

if (process.env.USE_MOCK_DB === 'true') {
  console.log('>>> [DB] Using In-Memory Mock Database for Live Preview');
  prismaInstance = mockPrisma;
} else {
  const realPrisma = new PrismaClient();
  // Wrap with a proxy that catches database connection failures and falls back to mockPrisma seamlessly
  prismaInstance = new Proxy(realPrisma, {
    get(target, prop, receiver) {
      if (prop === '$transaction') {
        return async (arg: any) => {
          try {
            return await target.$transaction(arg);
          } catch {
            return await mockPrisma.$transaction(arg);
          }
        };
      }
      const model = Reflect.get(target, prop, receiver);
      if (model && typeof model === 'object') {
        return new Proxy(model, {
          get(modelTarget, modelProp, modelReceiver) {
            const origMethod = Reflect.get(modelTarget, modelProp, modelReceiver);
            if (typeof origMethod === 'function') {
              return async (...args: any[]) => {
                try {
                  return await origMethod.apply(modelTarget, args);
                } catch {
                  const fallbackMethod = mockPrisma[prop as string]?.[modelProp as string];
                  if (fallbackMethod) {
                    return await fallbackMethod(...args);
                  }
                  throw new Error(`Method ${String(prop)}.${String(modelProp)} failed on real DB and no fallback mock.`);
                }
              };
            }
            return origMethod;
          },
        });
      }
      return model;
    },
  });
}

export const prisma = prismaInstance;
