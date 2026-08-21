# Mini Operations ERP (Phase 1)

A lightweight Operations ERP system for managing Inventory, Work Orders, Stock Transfers, and Customer Order Reservations.

> **Phase 1 Scope**: Backend Project Scaffolding, PostgreSQL + Prisma Setup, Database Schema Definition, Migrations, and Initial Data Seeding.
> *(Authentication, API business logic, and Frontend interface will be added in subsequent phases).*

---

## 🛠️ Tech Stack

- **Backend Framework**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma ORM
- **Password Hashing**: bcryptjs
- **Containerization**: Docker / Docker Compose

---

## 📋 Prerequisites

- **Node.js**: v18.x or v20.x
- **npm**: v9.x or later
- **Docker Desktop**: Docker Compose installed for running local PostgreSQL container (or a local PostgreSQL server on port `5432`).

---

## 🚀 Setup & Installation Instructions

### 1. Clone & Navigate to Backend
```bash
cd backend
```

### 2. Environment Configuration
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Ensure `DATABASE_URL` matches your local PostgreSQL configuration:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/min_erp?schema=public"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Local PostgreSQL Database (Docker)
Start the PostgreSQL container via Docker Compose:
```bash
docker compose up -d
```
*(Or ensure local PostgreSQL service is running on port `5432` with database `min_erp`).*

### 5. Run Database Migrations
Apply the Prisma migration to create the schema, tables, enums, indexes, and constraints:
```bash
npx prisma migrate dev
```

### 6. Run Seed Script
Populate the database with initial sample data (Locations, Categories, Items, Stock with reserved quantities, and Users with hashed passwords):
```bash
npx prisma db seed
```

---

## 🧪 Verification & Inspection

To inspect the seeded database tables and verify foreign key relationships:
```bash
npx prisma studio
```
Or run the dev server:
```bash
npm run dev
```
And navigate to `http://localhost:4000/health`.

---

## 📂 Backend Project Structure

```
backend/
├── prisma/
│   ├── migrations/      # Captured SQL migration files
│   ├── schema.prisma   # Complete ERP Prisma Data Model
│   └── seed.ts         # Sample data seeding script
├── src/
│   ├── config/         # Environment & DB configurations
│   ├── middleware/     # Custom Express middleware (future phases)
│   ├── modules/        # Domain business modules (future phases)
│   ├── utils/          # Helper functions & utilities
│   └── server.ts       # Express app initialization
├── .env.example        # Environment variable template
├── docker-compose.yml  # Local PostgreSQL service definition
├── package.json
└── tsconfig.json
```

---

## ℹ️ Phase Status Note

Authentication logic (JWT/roles), business logic (reservation state machine, shortage calculation, stock transfers), and the frontend UI are **not included in Phase 1** and will be implemented in subsequent phases.
