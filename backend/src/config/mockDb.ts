import bcrypt from 'bcryptjs';

// In-memory expanded dataset for live preview fallback
const locations: any[] = [
  { id: 'loc-wh-a', name: 'Warehouse A (Main)' },
  { id: 'loc-wh-b', name: 'Warehouse B (Secondary)' },
  { id: 'loc-fac-d', name: 'Assembly Factory Delta' },
];

const categories: any[] = [
  { id: 'cat-elec', name: 'Electronics' },
  { id: 'cat-comp', name: 'Raw Components' },
  { id: 'cat-sens', name: 'Sensors & Modules' },
  { id: 'cat-mech', name: 'Mechanical Hardware' },
];

const items: any[] = [
  { id: 'item-1', sku: 'MCU-ESP32-S3', name: 'ESP32-S3 Microcontroller', categoryId: 'cat-elec', category: categories[0] },
  { id: 'item-2', sku: 'DISP-OLED-128X64', name: '0.96 inch OLED Display', categoryId: 'cat-elec', category: categories[0] },
  { id: 'item-3', sku: 'RLY-4CH-5V', name: '4-Channel 5V Relay Module', categoryId: 'cat-comp', category: categories[1] },
  { id: 'item-4', sku: 'PSU-12V-5A', name: '12V 5A Power Adapter', categoryId: 'cat-comp', category: categories[1] },
  { id: 'item-5', sku: 'SEN-DHT22', name: 'DHT22 Temp & Humidity Sensor', categoryId: 'cat-sens', category: categories[2] },
  { id: 'item-6', sku: 'MOT-SERVO-MG996R', name: 'MG996R High-Torque Servo', categoryId: 'cat-mech', category: categories[3] },
  { id: 'item-7', sku: 'BRG-608ZZ', name: 'Precision 608ZZ Ball Bearing', categoryId: 'cat-mech', category: categories[3] },
  { id: 'item-8', sku: 'CAB-HARN-10P', name: '10-Pin Industrial Cable Harness', categoryId: 'cat-comp', category: categories[1] },
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
    name: 'Operations Lead',
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
  {
    id: 'usr-ops-2',
    name: 'Plant Specialist',
    email: 'factory.lead@minerp.local',
    passwordHash: passwordHash,
    role: 'OPERATIONS',
    locationId: 'loc-fac-d',
    location: locations[2],
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
    physicalQty: 250,
    reservedQty: 60,
    version: 1,
    createdAt: new Date('2026-08-01T08:00:00Z'),
    updatedAt: new Date('2026-08-01T08:00:00Z'),
  },
  {
    id: 'stk-2',
    itemId: 'item-2',
    item: items[1],
    locationId: 'loc-wh-a',
    location: locations[0],
    batch: 'BATCH-2026-002',
    physicalQty: 120,
    reservedQty: 20,
    version: 1,
    createdAt: new Date('2026-08-02T09:00:00Z'),
    updatedAt: new Date('2026-08-02T09:00:00Z'),
  },
  {
    id: 'stk-3',
    itemId: 'item-3',
    item: items[2],
    locationId: 'loc-wh-b',
    location: locations[1],
    batch: 'BATCH-2026-003',
    physicalQty: 400,
    reservedQty: 100,
    version: 1,
    createdAt: new Date('2026-08-03T10:00:00Z'),
    updatedAt: new Date('2026-08-03T10:00:00Z'),
  },
  {
    id: 'stk-4',
    itemId: 'item-4',
    item: items[3],
    locationId: 'loc-wh-b',
    location: locations[1],
    batch: 'BATCH-2026-004',
    physicalQty: 90,
    reservedQty: 0,
    version: 1,
    createdAt: new Date('2026-08-04T11:00:00Z'),
    updatedAt: new Date('2026-08-04T11:00:00Z'),
  },
  {
    id: 'stk-5',
    itemId: 'item-5',
    item: items[4],
    locationId: 'loc-wh-a',
    location: locations[0],
    batch: 'BATCH-2026-005',
    physicalQty: 180,
    reservedQty: 30,
    version: 1,
    createdAt: new Date('2026-08-05T12:00:00Z'),
    updatedAt: new Date('2026-08-05T12:00:00Z'),
  },
  {
    id: 'stk-6',
    itemId: 'item-6',
    item: items[5],
    locationId: 'loc-fac-d',
    location: locations[2],
    batch: 'BATCH-2026-006',
    physicalQty: 75,
    reservedQty: 15,
    version: 1,
    createdAt: new Date('2026-08-06T13:00:00Z'),
    updatedAt: new Date('2026-08-06T13:00:00Z'),
  },
  {
    id: 'stk-7',
    itemId: 'item-7',
    item: items[6],
    locationId: 'loc-fac-d',
    location: locations[2],
    batch: 'BATCH-2026-007',
    physicalQty: 500,
    reservedQty: 50,
    version: 1,
    createdAt: new Date('2026-08-07T14:00:00Z'),
    updatedAt: new Date('2026-08-07T14:00:00Z'),
  },
  {
    id: 'stk-8',
    itemId: 'item-8',
    item: items[7],
    locationId: 'loc-wh-a',
    location: locations[0],
    batch: 'BATCH-2026-008',
    physicalQty: 300,
    reservedQty: 40,
    version: 1,
    createdAt: new Date('2026-08-08T15:00:00Z'),
    updatedAt: new Date('2026-08-08T15:00:00Z'),
  },
];

const inventoryTransactions: any[] = [
  {
    id: 'tx-1',
    inventoryStockId: 'stk-1',
    type: 'RECEIPT',
    quantity: 250,
    referenceType: 'MANUAL',
    referenceId: 'INITIAL_SEED',
    idempotencyKey: 'tx-seed-1',
    createdAt: new Date('2026-08-01T08:00:00Z'),
  },
  {
    id: 'tx-2',
    inventoryStockId: 'stk-1',
    type: 'RESERVE',
    quantity: 60,
    referenceType: 'CUSTOMER_ORDER',
    referenceId: 'ord-3001',
    idempotencyKey: 'tx-seed-2',
    createdAt: new Date('2026-08-10T09:00:00Z'),
  },
];

const workOrders: any[] = [
  {
    id: 'wo-1001',
    locationId: 'loc-wh-a',
    location: locations[0],
    itemId: 'item-1',
    item: items[0],
    requiredQty: 100,
    assignedUserId: 'usr-ops',
    assignedUser: users[1],
    status: 'IN_PROGRESS',
    createdAt: new Date('2026-08-10T10:00:00Z'),
  },
  {
    id: 'wo-1002',
    locationId: 'loc-wh-a',
    location: locations[0],
    itemId: 'item-2',
    item: items[1],
    requiredQty: 150, // Available: 100 -> Shortage: 50
    assignedUserId: 'usr-ops',
    assignedUser: users[1],
    status: 'ASSIGNED',
    createdAt: new Date('2026-08-12T11:00:00Z'),
  },
  {
    id: 'wo-1003',
    locationId: 'loc-wh-b',
    location: locations[1],
    itemId: 'item-3',
    item: items[2],
    requiredQty: 80,
    assignedUserId: 'usr-ops',
    assignedUser: users[1],
    status: 'COMPLETED',
    createdAt: new Date('2026-08-05T09:00:00Z'),
  },
  {
    id: 'wo-1004',
    locationId: 'loc-fac-d',
    location: locations[2],
    itemId: 'item-6',
    item: items[5],
    requiredQty: 50,
    assignedUserId: 'usr-ops-2',
    assignedUser: users[3],
    status: 'ASSIGNED',
    createdAt: new Date('2026-08-15T14:00:00Z'),
  },
];

const stockTransfers: any[] = [
  {
    id: 'tf-2001',
    sourceLocationId: 'loc-wh-b',
    sourceLocation: locations[1],
    destinationLocationId: 'loc-wh-a',
    destinationLocation: locations[0],
    itemId: 'item-2',
    item: items[1],
    quantity: 50,
    receivedQty: 0,
    remainingQty: 50,
    status: 'DISPATCHED',
    createdAt: new Date('2026-08-14T09:30:00Z'),
  },
  {
    id: 'tf-2002',
    sourceLocationId: 'loc-wh-a',
    sourceLocation: locations[0],
    destinationLocationId: 'loc-fac-d',
    destinationLocation: locations[2],
    itemId: 'item-8',
    item: items[7],
    quantity: 100,
    receivedQty: 40,
    remainingQty: 60,
    status: 'PARTIALLY_RECEIVED',
    createdAt: new Date('2026-08-13T11:00:00Z'),
  },
  {
    id: 'tf-2003',
    sourceLocationId: 'loc-wh-b',
    sourceLocation: locations[1],
    destinationLocationId: 'loc-wh-a',
    destinationLocation: locations[0],
    itemId: 'item-4',
    item: items[3],
    quantity: 30,
    receivedQty: 30,
    remainingQty: 0,
    status: 'RECEIVED',
    createdAt: new Date('2026-08-08T15:00:00Z'),
  },
  {
    id: 'tf-2004',
    sourceLocationId: 'loc-wh-a',
    sourceLocation: locations[0],
    destinationLocationId: 'loc-wh-b',
    destinationLocation: locations[1],
    itemId: 'item-5',
    item: items[4],
    quantity: 40,
    receivedQty: 0,
    remainingQty: 40,
    status: 'REQUESTED',
    createdAt: new Date('2026-08-16T16:00:00Z'),
  },
];

const customerOrders: any[] = [
  {
    id: 'ord-3001',
    customerName: 'Acme Robotics Corp',
    salesUserId: 'usr-sales',
    salesUser: users[2],
    status: 'RESERVED',
    createdAt: new Date('2026-08-10T09:00:00Z'),
    lines: [
      {
        id: 'line-1',
        itemId: 'item-1',
        item: items[0],
        locationId: 'loc-wh-a',
        location: locations[0],
        inventoryStockId: 'stk-1',
        inventoryStock: inventoryStocks[0],
        quantity: 60,
      },
      {
        id: 'line-2',
        itemId: 'item-5',
        item: items[4],
        locationId: 'loc-wh-a',
        location: locations[0],
        inventoryStockId: 'stk-5',
        inventoryStock: inventoryStocks[4],
        quantity: 30,
      },
    ],
  },
  {
    id: 'ord-3002',
    customerName: 'NexGen Automation Ltd',
    salesUserId: 'usr-sales',
    salesUser: users[2],
    status: 'FULFILLED',
    createdAt: new Date('2026-08-04T14:00:00Z'),
    lines: [
      {
        id: 'line-3',
        itemId: 'item-3',
        item: items[2],
        locationId: 'loc-wh-b',
        location: locations[1],
        inventoryStockId: 'stk-3',
        inventoryStock: inventoryStocks[2],
        quantity: 100,
      },
    ],
  },
  {
    id: 'ord-3003',
    customerName: 'Global Micro Systems',
    salesUserId: 'usr-sales',
    salesUser: users[2],
    status: 'CANCELLED',
    createdAt: new Date('2026-08-02T10:00:00Z'),
    lines: [
      {
        id: 'line-4',
        itemId: 'item-2',
        item: items[1],
        locationId: 'loc-wh-a',
        location: locations[0],
        inventoryStockId: 'stk-2',
        inventoryStock: inventoryStocks[1],
        quantity: 20,
      },
    ],
  },
];

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
    findUnique: async (args: any) => {
      if (args.where?.idempotencyKey) {
        return inventoryTransactions.find((tx) => tx.idempotencyKey === args.where.idempotencyKey) || null;
      }
      if (args.where?.id) {
        return inventoryTransactions.find((tx) => tx.id === args.where.id) || null;
      }
      return null;
    },
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
