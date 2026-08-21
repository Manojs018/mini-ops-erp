# Mini Operations ERP

A lightweight, enterprise-grade Operations ERP solution comprising a high-concurrency Node.js/TypeScript Express backend and a modern, role-aware React frontend.

---

## Tech Stack

### Backend (`/backend`)
- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (v5+)
- **Framework**: Express.js
- **Database**: PostgreSQL (v14+) & Prisma ORM (v5.22+)
- **Authentication**: JWT (`jsonwebtoken`) & `bcryptjs`
- **Testing**: Jest & Supertest (72 unit, API & concurrency tests)

### Frontend (`/frontend`)
- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Lucide Icons + Google Fonts (Inter)
- **Data Fetching**: TanStack Query (React Query) & Axios
- **Routing & Guards**: React Router v7 + Auth & Role Guards
- **Analytics**: Recharts (Pie & Bar charts)

---

## Architecture & Features

### 1. Role Matrix & Access Control
- **ADMIN**: Full read/write access across all modules (Inventory creation/adjustment/damage, Work Order creation & status, Stock Transfer creation/dispatch/receive, Customer Order creation & cancellation override).
- **OPERATIONS**: Read all modules. Create, adjust, and report damage on inventory. Update assigned Work Order status (`ASSIGNED -> IN_PROGRESS -> COMPLETED`). Request, dispatch, and receive internal stock transfers. Cannot create Work Orders or Customer Orders.
- **SALES**: Read all modules. Create Customer Orders with multi-line batch selection. Cancel own Customer Orders (`reservedQty` released). Cannot modify inventory, Work Orders, or Stock Transfers.

### 2. Live-Verification Readiness & Change Coverage
- **Damaged Stock Handling**: Dedicated `POST /inventory/:id/report-damage` endpoint and UI modal to deduct physical stock and log damage transactions.
- **Partial Transfer Receipt**: `PATCH /transfers/:id/receive` with optional `quantity` input and visual progress meter (`receivedQty` / `remainingQty`).
- **All-Or-Nothing Multi-Line Reservation**: Customer Orders reserve stock atomically across multiple lines or roll back completely (`409 Conflict`).
- **Order Cancellation & Stock Release**: `PATCH /orders/:id/cancel` restores reserved stock (`availableQty` increases) via `releaseStock()`.
- **Location Restriction Middleware**: Built-in middleware (`restrictToLocation`) enforcing user location scoping.

---

## Setup & Running Locally

### 1. Backend Setup (`/backend`)
```bash
cd backend
npm install
```

Set up `.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/minerp?schema=public"
PORT=3000
JWT_SECRET="dev-jwt-secret-min-erp-2026-key"
```

Run database migrations and seed script:
```bash
npx prisma migrate dev --name init
npm run seed
```

Start the backend server:
```bash
npm run dev
# Server running at http://localhost:3000
```

Run backend test suite:
```bash
npm test
```

### 2. Frontend Setup (`/frontend`)
```bash
cd frontend
npm install
```

Set up `.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
```

Start the frontend Vite dev server:
```bash
npm run dev
# App running at http://localhost:5173
```

Build production bundle:
```bash
npm run build
```

---

## Demo & Verification Sequence

1. **Log in as ADMIN** (`admin@minerp.local` / `password123`):
   - Access **Dashboard** with live stock metrics and Recharts pipeline visualization.
   - Navigate to **Inventory** to view live stock batches, physical/reserved/available meters.
   - Click **Adjust Stock** or **Report Damage** to adjust inventory levels.

2. **Work Order Shortage & Transfer Flow**:
   - Go to **Work Orders** -> Click **Create Work Order** for an item requiring 100 units at Main Warehouse.
   - Click the Work Order row -> Observe material shortage warning (`shortage = max(0, required - available)`).
   - Click **Create Transfer for Shortage** button -> Auto-fills transfer request for secondary warehouse.
   - Go to **Transfers** -> Click **Dispatch** (source stock deducted immediately).
   - Click **Receive** -> Choose Partial Receipt (e.g. 40 units) or Full Receipt.
   - Return to Work Order -> Click **Refresh Stock Check** -> Observe shortage updates to 0.

3. **Customer Order Reservation & Cancellation Flow**:
   - Log in as **SALES** (`sales@minerp.local` / `password123`).
   - Go to **Customer Orders** -> Click **Create Customer Order**.
   - Build multi-line order selecting batch and quantity -> Click **Place Customer Order**.
   - Inspect **Inventory** -> Observe `reservedQty` increased and `availableQty` decreased, while `physicalQty` remains unchanged.
   - Go to **Customer Orders** -> Click **Cancel Order**.
   - Inspect **Inventory** -> Observe `reservedQty` released and `availableQty` restored.

---

## Project Structure

```
minErp/
├── backend/
│   ├── prisma/            # Schema definition & migrations
│   ├── src/
│   │   ├── middleware/    # Auth, Role, & Location restriction
│   │   ├── modules/       # Auth, Inventory, WorkOrders, Transfers, Orders
│   │   └── app.ts         # Express app configuration & CORS
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/           # Typed Axios API clients & error handler
│   │   ├── components/    # Common UI, layout shell, & module modals
│   │   ├── context/       # AuthContext session management
│   │   ├── pages/         # Login, Dashboard, Inventory, WorkOrders, Transfers, Orders
│   │   ├── router/        # AppRouter & ProtectedRoute / RoleGuard
│   │   └── types/         # TypeScript interfaces
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
└── docs/                  # API documentation & location restriction guide
```
