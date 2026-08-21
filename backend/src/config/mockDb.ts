import bcrypt from 'bcryptjs';

// In-memory data store for live preview fallback
const locations: any[] = [
  { id: 'loc-wh-a', name: 'Warehouse A' },
  { id: 'loc-wh-b', name: 'Warehouse B' },
];

const categories: any[] = [
  { id: 'cat-elec', name: 'Electronics' },
  { id: 'cat-comp', name: 'Raw Components' },
];

const items: any[] = [
  { id: 'item-1', sku: 'MCU-ESP32-S3', name: 'ESP32-S3 Microcontroller', categoryId: 'cat-elec', category: categories[0] },
  { id: 'item-2', sku: 'DISP-OLED-128X64', name: '0.96 inch OLED Display', categoryId: 'cat-elec', category: categories[0] },
  { id: 'item-3', sku: 'RLY-4CH-5V', name: '4-Channel 5V Relay Module', categoryId: 'cat-comp', category: categories[1] },
  { id: 'item-4', sku: 'PSU-12V-5A', name: '12V 5A Power Supply Adapter', categoryId: 'cat-comp', category: categories[1] },
  { id: 'item-5', sku: 'SEN-DHT22', name: 'DHT22 Temperature & Humidity Sensor', categoryId: 'cat-elec', category: categories[0] },
];

const passwordHash = bcrypt.hashSync('password123', 10);

const users: any[] = [
  {
    id: 'usr-admin',
    name: 'System Admin',
    email: 'admin@minerp.local',
    passwordHash: passwordHash,
    role: 'ADMIN',
    locationId: 'loc-wh-a',
    location: locations[0],
  },
  {
    id: 'usr-ops',
    name: 'Operations Manager',
    email: 'ops@minerp.local',
    passwordHash: passwordHash,
    role: 'OPERATIONS',
    locationId: 'loc-wh-a',
    location: locations[0],
  },
  {
    id: 'usr-sales',
    name: 'Sales Representative',
    email: 'sales@minerp.local',
    passwordHash: passwordHash,
    role: 'SALES',
    locationId: 'loc-wh-b',
    location: locations[1],
  },
];

const inventoryStocks: any[] = [
  {
    id: 'stk-1',
    itemId: 'item-1',
    item: items[0],
    locationId: 'loc-wh-a',
    location: locations[0],
    batch: 'BATCH-2026-001',
    physicalQty: 150,
    reservedQty: 30,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'stk-2',
    itemId: 'item-2',
    item: items[1],
    locationId: 'loc-wh-a',
    location: locations[0],
    batch: 'BATCH-2026-002',
    physicalQty: 80,
    reservedQty: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'stk-3',
    itemId: 'item-3',
    item: items[2],
    locationId: 'loc-wh-b',
    location: locations[1],
    batch: 'BATCH-2026-003',
    physicalQty: 200,
    reservedQty: 50,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'stk-4',
    itemId: 'item-4',
    item: items[3],
    locationId: 'loc-wh-b',
    location: locations[1],
    batch: 'BATCH-2026-004',
    physicalQty: 45,
    reservedQty: 0,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'stk-5',
    itemId: 'item-5',
    item: items[4],
    locationId: 'loc-wh-a',
    location: locations[0],
    batch: 'BATCH-2026-005',
    physicalQty: 110,
    reservedQty: 10,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const inventoryTransactions: any[] = [];
const workOrders: any[] = [
  {
    id: 'wo-1001',
    locationId: 'loc-wh-a',
    location: locations[0],
    itemId: 'item-1',
    item: items[0],
    requiredQty: 50,
    assignedUserId: 'usr-ops',
    assignedUser: users[1],
    status: 'ASSIGNED',
    createdAt: new Date(),
  },
];
const stockTransfers: any[] = [];
const customerOrders: any[] = [];

export const mockPrisma: any = {
  user: {
    findUnique: async (args: any) => {
      if (args.where?.id) return users.find((u) => u.id === args.where.id) || null;
      if (args.where?.email) return users.find((u) => u.email === args.where.email) || null;
      return null;
    },
    findMany: async () => users,
  },
  location: {
    findMany: async () => locations,
    findUnique: async (args: any) => locations.find((l) => l.id === args.where.id) || null,
  },
  category: {
    findMany: async () => categories,
  },
  item: {
    findMany: async () => items,
    findUnique: async (args: any) => items.find((i) => i.id === args.where.id) || null,
  },
  inventoryStock: {
    findMany: async (args: any = {}) => {
      let list = [...inventoryStocks];
      if (args.where?.locationId) list = list.filter((s) => s.locationId === args.where.locationId);
      if (args.where?.itemId) list = list.filter((s) => s.itemId === args.where.itemId);
      if (args.skip !== undefined && args.take !== undefined) {
        list = list.slice(args.skip, args.skip + args.take);
      }
      return list;
    },
    findUnique: async (args: any) => inventoryStocks.find((s) => s.id === args.where.id) || null,
    findFirst: async (args: any) => {
      return (
        inventoryStocks.find((s) => {
          let match = true;
          if (args.where?.itemId) match = match && s.itemId === args.where.itemId;
          if (args.where?.locationId) match = match && s.locationId === args.where.locationId;
          if (args.where?.batch) match = match && s.batch === args.where.batch;
          return match;
        }) || null
      );
    },
    count: async (args: any = {}) => {
      let list = [...inventoryStocks];
      if (args.where?.locationId) list = list.filter((s) => s.locationId === args.where.locationId);
      return list.length;
    },
    create: async (args: any) => {
      const item = items.find((i) => i.id === args.data.itemId) || items[0];
      const loc = locations.find((l) => l.id === args.data.locationId) || locations[0];
      const newStock = {
        id: `stk-${Date.now()}`,
        itemId: args.data.itemId,
        item,
        locationId: args.data.locationId,
        location: loc,
        batch: args.data.batch,
        physicalQty: args.data.physicalQty,
        reservedQty: args.data.reservedQty || 0,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      inventoryStocks.push(newStock);
      return newStock;
    },
    update: async (args: any) => {
      const idx = inventoryStocks.findIndex((s) => s.id === args.where.id);
      if (idx === -1) throw new Error('Record not found');
      const current = inventoryStocks[idx];
      const updated = { ...current };
      if (args.data.physicalQty?.increment !== undefined) updated.physicalQty += args.data.physicalQty.increment;
      if (args.data.physicalQty?.decrement !== undefined) updated.physicalQty -= args.data.physicalQty.decrement;
      if (typeof args.data.physicalQty === 'number') updated.physicalQty = args.data.physicalQty;
      if (args.data.reservedQty?.increment !== undefined) updated.reservedQty += args.data.reservedQty.increment;
      if (args.data.reservedQty?.decrement !== undefined) updated.reservedQty -= args.data.reservedQty.decrement;
      if (typeof args.data.reservedQty === 'number') updated.reservedQty = args.data.reservedQty;

      inventoryStocks[idx] = updated;
      return updated;
    },
    updateMany: async (args: any) => {
      const target = inventoryStocks.find((s) => s.id === args.where.id);
      if (!target) return { count: 0 };
      if (args.where.version !== undefined && target.version !== args.where.version) return { count: 0 };
      if (args.where.physicalQty?.gte !== undefined && target.physicalQty < args.where.physicalQty.gte) return { count: 0 };

      if (args.data.reservedQty?.increment !== undefined) target.reservedQty += args.data.reservedQty.increment;
      if (args.data.reservedQty?.decrement !== undefined) target.reservedQty -= args.data.reservedQty.decrement;
      if (args.data.physicalQty?.increment !== undefined) target.physicalQty += args.data.physicalQty.increment;
      if (args.data.physicalQty?.decrement !== undefined) target.physicalQty -= args.data.physicalQty.decrement;
      if (args.data.version?.increment !== undefined) target.version += args.data.version.increment;

      return { count: 1 };
    },
  },
  inventoryTransaction: {
    findMany: async () => inventoryTransactions,
    findFirst: async (args: any) => {
      if (args.where?.idempotencyKey) {
        return inventoryTransactions.find((tx) => tx.idempotencyKey === args.where.idempotencyKey) || null;
      }
      return null;
    },
    create: async (args: any) => {
      const tx = { id: `tx-${Date.now()}`, ...args.data, createdAt: new Date() };
      inventoryTransactions.push(tx);
      return tx;
    },
  },
  workOrder: {
    findMany: async (args: any = {}) => {
      let list = [...workOrders];
      if (args.where?.status) list = list.filter((wo) => wo.status === args.where.status);
      if (args.where?.assignedUserId) list = list.filter((wo) => wo.assignedUserId === args.where.assignedUserId);
      if (args.skip !== undefined && args.take !== undefined) {
        list = list.slice(args.skip, args.skip + args.take);
      }
      return list;
    },
    findUnique: async (args: any) => workOrders.find((wo) => wo.id === args.where.id) || null,
    count: async () => workOrders.length,
    create: async (args: any) => {
      const item = items.find((i) => i.id === args.data.itemId);
      const loc = locations.find((l) => l.id === args.data.locationId);
      const user = users.find((u) => u.id === args.data.assignedUserId);
      const newWO = {
        id: `wo-${Date.now().toString().slice(-4)}`,
        locationId: args.data.locationId,
        location: loc,
        itemId: args.data.itemId,
        item,
        requiredQty: args.data.requiredQty,
        assignedUserId: args.data.assignedUserId,
        assignedUser: user,
        status: 'ASSIGNED',
        createdAt: new Date(),
      };
      workOrders.push(newWO);
      return newWO;
    },
    update: async (args: any) => {
      const idx = workOrders.findIndex((wo) => wo.id === args.where.id);
      if (idx === -1) throw new Error('Work Order not found');
      workOrders[idx] = { ...workOrders[idx], ...args.data };
      return workOrders[idx];
    },
  },
  stockTransfer: {
    findMany: async (args: any = {}) => {
      let list = [...stockTransfers];
      if (args.where?.status) list = list.filter((tf) => tf.status === args.where.status);
      if (args.skip !== undefined && args.take !== undefined) {
        list = list.slice(args.skip, args.skip + args.take);
      }
      return list;
    },
    findUnique: async (args: any) => stockTransfers.find((tf) => tf.id === args.where.id) || null,
    count: async () => stockTransfers.length,
    create: async (args: any) => {
      const srcLoc = locations.find((l) => l.id === args.data.sourceLocationId);
      const destLoc = locations.find((l) => l.id === args.data.destinationLocationId);
      const item = items.find((i) => i.id === args.data.itemId);
      const newTF = {
        id: `tf-${Date.now().toString().slice(-4)}`,
        sourceLocationId: args.data.sourceLocationId,
        sourceLocation: srcLoc,
        destinationLocationId: args.data.destinationLocationId,
        destinationLocation: destLoc,
        itemId: args.data.itemId,
        item,
        quantity: args.data.quantity,
        receivedQty: 0,
        remainingQty: args.data.quantity,
        status: 'REQUESTED',
        createdAt: new Date(),
      };
      stockTransfers.push(newTF);
      return newTF;
    },
    update: async (args: any) => {
      const idx = stockTransfers.findIndex((tf) => tf.id === args.where.id);
      if (idx === -1) throw new Error('Transfer not found');
      stockTransfers[idx] = { ...stockTransfers[idx], ...args.data };
      return stockTransfers[idx];
    },
  },
  customerOrder: {
    findMany: async (args: any = {}) => {
      let list = [...customerOrders];
      if (args.where?.status) list = list.filter((o) => o.status === args.where.status);
      if (args.skip !== undefined && args.take !== undefined) {
        list = list.slice(args.skip, args.skip + args.take);
      }
      return list;
    },
    findUnique: async (args: any) => customerOrders.find((o) => o.id === args.where.id) || null,
    count: async () => customerOrders.length,
    create: async (args: any) => {
      const salesUser = users.find((u) => u.id === args.data.salesUserId);
      const lines = (args.data.lines?.create || []).map((l: any, i: number) => {
        const stk = inventoryStocks.find((s) => s.id === l.inventoryStockId);
        return {
          id: `line-${Date.now()}-${i}`,
          itemId: l.itemId,
          item: stk?.item,
          locationId: l.locationId,
          location: stk?.location,
          inventoryStockId: l.inventoryStockId,
          inventoryStock: stk,
          quantity: l.quantity,
        };
      });

      const newOrder = {
        id: `ord-${Date.now().toString().slice(-4)}`,
        customerName: args.data.customerName,
        salesUserId: args.data.salesUserId,
        salesUser,
        status: 'RESERVED',
        createdAt: new Date(),
        lines,
      };

      customerOrders.push(newOrder);
      return newOrder;
    },
    update: async (args: any) => {
      const idx = customerOrders.findIndex((o) => o.id === args.where.id);
      if (idx === -1) throw new Error('Order not found');
      customerOrders[idx] = { ...customerOrders[idx], ...args.data };
      return customerOrders[idx];
    },
  },
  $transaction: async (action: any) => {
    if (typeof action === 'function') {
      return await action(mockPrisma);
    }
    if (Array.isArray(action)) {
      return await Promise.all(action);
    }
    return action;
  },
};
