# Mini Operations ERP

A lightweight Operations ERP system for managing Inventory, Work Orders, Stock Transfers, and Customer Order Reservations.

> **Phase 1 Status**: Backend Scaffolding, PostgreSQL + Prisma Setup, Schema Definition, Migrations & Initial Seed Script.
> **Phase 2 Status**: Authentication & Role-Based Authorization (JWT tokens, bcrypt password hashing, `authenticate` & `requireRole` middlewares, login, `/auth/me`, and integration test suite).

---

## 🛠️ Tech Stack

- **Backend Framework**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma ORM
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) with 8-hour access token expiration
- **Password Hashing**: `bcryptjs`
- **Testing**: Jest + Supertest (`ts-jest`)
- **Containerization**: Docker / Docker Compose

---

## 📋 Prerequisites

- **Node.js**: v18.x or v20.x
- **npm**: v9.x or later
- **Docker Desktop**: Docker Compose installed for running local PostgreSQL container (or local PostgreSQL server on port `5432`).

---

## 🚀 Setup & Installation Instructions

### 1. Clone & Navigate to Backend
```bash
cd backend
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure environment variables are configured:
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/min_erp?schema=public"
JWT_SECRET="dev-jwt-secret-min-erp-2026-key"
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

### 5. Run Database Migrations
Apply the Prisma migration to set up the database schema:
```bash
npx prisma migrate dev
```

### 6. Run Seed Script
Populate the database with sample data (Locations, Categories, Items, Stock with reserved quantities, and Users):
```bash
npx prisma db seed
```

---

## 🔑 Authentication & Role Authorization (Phase 2)

### How Auth Works
- **Token Mechanism**: Authentication uses JSON Web Tokens (JWT) signed with `JWT_SECRET` expiring in 8 hours.
- **Header Format**: Send the token in protected requests via the HTTP `Authorization` header:
  ```
  Authorization: Bearer <your_jwt_access_token>
  ```
- **Seeded Test Accounts**:
  - `admin@minerp.local` (Role: `ADMIN`)
  - `ops@minerp.local` (Role: `OPERATIONS`)
  - `sales@minerp.local` (Role: `SALES`)
  - Password for all seeded users: `Password123!`

---

## 📡 API Endpoints (Auth Module)

### 1. POST `/auth/login`
Authenticates a user and returns a signed JWT access token alongside user profile info (password hash excluded).

**Request Body**:
```json
{
  "email": "admin@minerp.local",
  "password": "Password123!"
}
```

**Response (200 OK)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "c1f7b80a-9d7a-4286-9a3b-280430e70a25",
    "name": "System Admin",
    "email": "admin@minerp.local",
    "role": "ADMIN",
    "locationId": "b48c03e8-54b2-4d1a-96e0-2f95cd34125b"
  }
}
```

**Example Curl**:
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@minerp.local","password":"Password123!"}'
```

---

### 2. GET `/auth/me`
Retrieves the profile of the currently authenticated user based on the JWT token.

**Headers**:
```
Authorization: Bearer <jwt_access_token>
```

**Response (200 OK)**:
```json
{
  "user": {
    "id": "c1f7b80a-9d7a-4286-9a3b-280430e70a25",
    "name": "System Admin",
    "email": "admin@minerp.local",
    "role": "ADMIN",
    "locationId": "b48c03e8-54b2-4d1a-96e0-2f95cd34125b"
  }
}
```

**Example Curl**:
```bash
curl -X GET http://localhost:4000/auth/me \
  -H "Authorization: Bearer <jwt_access_token>"
```

---

### 3. GET `/auth/admin-only`
Smoke-test route protected by `authenticate` and `requireRole(['ADMIN'])`.

**Example Curl**:
```bash
curl -X GET http://localhost:4000/auth/admin-only \
  -H "Authorization: Bearer <jwt_access_token>"
```

---

## 🧪 Running Automated Tests

Run the full integration test suite using Jest and Supertest:
```bash
cd backend
npm test
```

---

## 📂 Backend Project Structure

```
backend/
├── prisma/
│   ├── migrations/      # Captured SQL migration files
│   ├── schema.prisma   # Complete ERP Prisma Data Model
│   └── seed.ts         # Sample data seeding script
├── src/
│   ├── config/         # Database & Prisma Client singleton
│   ├── middleware/     # authenticate, requireRole, & errorHandler
│   ├── modules/
│   │   └── auth/       # auth.routes, auth.controller, auth.service, auth.test
│   ├── types/          # Express Request module augmentation
│   ├── utils/          # JWT utilities & AppError class
│   ├── app.ts          # Express application setup
│   └── server.ts       # Express server initialization
├── .env.example        # Environment variable template
├── docker-compose.yml  # Local PostgreSQL service definition
├── jest.config.ts      # Jest configuration for TypeScript
├── package.json
└── tsconfig.json
```
