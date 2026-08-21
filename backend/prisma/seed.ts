import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Shared placeholder password for development/seed data: "Password123!"
const PLACEHOLDER_PASSWORD = 'Password123!';

async function main() {
  console.log('Seeding database with initial ERP sample data...');

  // 1. Create 2 Locations
  const warehouseA = await prisma.location.create({
    data: { name: 'Warehouse A' },
  });

  const warehouseB = await prisma.location.create({
    data: { name: 'Warehouse B' },
  });

  // 2. Create 2 Categories
  const catElectronics = await prisma.category.create({
    data: { name: 'Electronics' },
  });

  const catComponents = await prisma.category.create({
    data: { name: 'Raw Components' },
  });

  // 3. Create 5 Items across categories
  const item1 = await prisma.item.create({
    data: {
      sku: 'MCU-ESP32-S3',
      name: 'ESP32-S3 Microcontroller',
      categoryId: catElectronics.id,
    },
  });

  const item2 = await prisma.item.create({
    data: {
      sku: 'DISP-OLED-128X64',
      name: '0.96 inch OLED Display',
      categoryId: catElectronics.id,
    },
  });

  const item3 = await prisma.item.create({
    data: {
      sku: 'RLY-4CH-5V',
      name: '4-Channel 5V Relay Module',
      categoryId: catComponents.id,
    },
  });

  const item4 = await prisma.item.create({
    data: {
      sku: 'PSU-12V-5A',
      name: '12V 5A Power Supply Adapter',
      categoryId: catComponents.id,
    },
  });

  const item5 = await prisma.item.create({
    data: {
      sku: 'SEN-DHT22',
      name: 'DHT22 Temperature & Humidity Sensor',
      categoryId: catElectronics.id,
    },
  });

  // 4. Create InventoryStock rows with physicalQty/reservedQty values
  // Includes reservedQty > 0 so availableQty (physicalQty - reservedQty) math is visible
  await prisma.inventoryStock.createMany({
    data: [
      {
        itemId: item1.id,
        locationId: warehouseA.id,
        batch: 'BATCH-2026-001',
        physicalQty: 150,
        reservedQty: 30, // Available: 120
      },
      {
        itemId: item2.id,
        locationId: warehouseA.id,
        batch: 'BATCH-2026-002',
        physicalQty: 80,
        reservedQty: 0, // Available: 80
      },
      {
        itemId: item3.id,
        locationId: warehouseB.id,
        batch: 'BATCH-2026-003',
        physicalQty: 200,
        reservedQty: 50, // Available: 150
      },
      {
        itemId: item4.id,
        locationId: warehouseB.id,
        batch: 'BATCH-2026-004',
        physicalQty: 45,
        reservedQty: 0, // Available: 45
      },
      {
        itemId: item5.id,
        locationId: warehouseA.id,
        batch: 'BATCH-2026-005',
        physicalQty: 110,
        reservedQty: 10, // Available: 100
      },
    ],
  });

  // 5. Create 3 Users (ADMIN, OPERATIONS, SALES) with hashed passwords
  // Fake emails and placeholder password "Password123!" used for dev readiness
  const passwordHash = await bcrypt.hash(PLACEHOLDER_PASSWORD, 10);

  await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@minerp.local',
      passwordHash: passwordHash,
      role: Role.ADMIN,
      locationId: warehouseA.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Operations Manager',
      email: 'ops@minerp.local',
      passwordHash: passwordHash,
      role: Role.OPERATIONS,
      locationId: warehouseA.id,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Sales Representative',
      email: 'sales@minerp.local',
      passwordHash: passwordHash,
      role: Role.SALES,
      locationId: warehouseB.id,
    },
  });

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
