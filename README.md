# Mini Operations ERP

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0+-61DAFB?logo=react)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express.js-4.19+-000000?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22+-2D3748?logo=prisma)](https://www.prisma.io/)
[![Jest](https://img.shields.io/badge/Jest-29.0+-C21325?logo=jest)](https://jestjs.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

A production-grade, enterprise operations ERP solution designed for high-concurrency inventory management, work order tracking, internal stock transfers, and customer order reservations. Built with a robust Node.js/TypeScript Express REST API backend and a responsive, role-aware React 19 frontend.

---

## 🛠️ Tech Stack

### Backend (`/backend`)
- **Runtime Environment**: Node.js (v18+)
- **Language**: TypeScript (v5.0+)
- **Web Framework**: Express.js
- **Database & ORM**: PostgreSQL (v14+) with Prisma ORM (v5.22+)
- **Authentication & Security**: JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), CORS Security, & Custom Role Middleware
- **Testing Engine**: Jest (v29+) & Supertest for Unit, API Endpoint, and Atomic Concurrency Tests (72/72 tests passing)

### Frontend (`/frontend`)
- **Framework**: React 19 + TypeScript + Vite
- **Styling & UI**: Tailwind CSS v4 + Lucide React Icons + Google Fonts (Inter)
- **State & Data Management**: TanStack Query (React Query v5) & Axios HTTP Client
- **Routing & Access Control**: React Router v7 + Guarded Route wrappers (`ProtectedRoute`, `RoleGuard`)
- **Data Visualization**: Recharts (Pie & Bar chart analytics)

---

## 🔑 Role-Based Access Control (RBAC)

The system enforces strict role-based authorization across backend controllers and frontend UI components:

| Role | Access Level & Permissions |
| :--- | :--- |
| **`ADMIN`** | Full read/write access across all system modules. Can create items, adjust stock, report damage, create Work Orders, transition Work Order statuses, request/dispatch/receive stock transfers, and create/cancel customer orders. |
| **`OPERATIONS`** | Read access to all modules. Can create stock, adjust stock quantities, report damage, update status of assigned Work Orders (`ASSIGNED -> IN_PROGRESS -> COMPLETED`), and handle internal stock transfers (request, dispatch, receive). |
| **`SALES`** | Read access to all modules. Can create Customer Orders with multi-line batch selection and cancel owned Customer Orders (releasing reserved stock). Blocked from creating or modifying Work Orders, Inventory Stock, or Stock Transfers. |

---

## 📁 Environment Variables

### Backend Environment (`/backend/.env`)

Create a `.env` file inside the `backend/` directory:

```env
# Server Port
PORT=4000

# PostgreSQL Connection String
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/min_erp?schema=public"

# JWT Authentication Secret
JWT_SECRET="dev-jwt-secret-min-erp-2026-key"

# Allowed Frontend Origin (Optional for CORS configuration)
FRONTEND_URL="http://localhost:5173"
```

### Frontend Environment (`/frontend/.env`)

Create a `.env` file inside the `frontend/` directory:

```env
# Backend API Base URL
VITE_API_BASE_URL=http://localhost:4000
```

---

## ⚙️ Project & Database Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: v14.0 or higher *(Optional: Backend includes an automatic offline demo proxy mode)*

### 1. Repository Setup

Clone the repository to your local machine:
```bash
git clone https://github.com/Manojs018/mini-ops-erp.git
cd mini-ops-erp
```

### 2. Backend Database Setup

Navigate to the backend directory and install dependencies:
```bash
cd backend
npm install
```

Push database schema migrations and populate initial seed data into PostgreSQL:
```bash
# Push Prisma schema to PostgreSQL database
npx prisma db push

# Generate Prisma Client types
npx prisma generate

# Seed initial locations, categories, items, stock batches, and demo users
npm run seed
```

---

[![Architecture diagram](https://gitdiagram.com/diagram-badge.svg)](https://gitdiagram.com/manojs018/mini-ops-erp?utm_source=readme&utm_medium=badge)

## 🚀 How to Run

### Step 1: Start Backend Server
In the `backend/` directory, start the Express development server:
```bash
cd backend
npm run dev
```
The backend API server will start on **`http://localhost:4000`**.

### Step 2: Start Frontend Application
In a separate terminal window, navigate to the `frontend/` directory, install dependencies, and start Vite:
```bash
cd frontend
npm install
npm run dev
```
The frontend portal will start on **`http://localhost:5173`** (or `http://localhost:5174`).

---

## 🧪 How to Test

### 1. Run Automated Backend Test Suite
The backend features a comprehensive Jest test suite covering Unit logic, API Endpoints, State Machines, and Concurrency Race-Condition protection.

In the `backend/` directory, run:
```bash
npm test
```

#### Test Suite Highlights (72/72 Passing Tests):
- **Auth Module**: JWT generation, login authorization, password hashing, and role middleware (`auth.test.ts`).
- **Inventory Module**: Available quantity calculations, negative stock guards, duplicate batch prevention, and damage reporting (`inventory.test.ts`).
- **Concurrency Engine**: Atomic conditional updates (`UPDATE WHERE (physical - reserved) >= qty`) and double-cancellation guards (`inventory.concurrency.test.ts`).
- **Work Orders**: Strict state machine transitions (`ASSIGNED -> IN_PROGRESS -> COMPLETED`), operator assignment validation, and material shortage calculations (`work-order.test.ts`).
- **Stock Transfers**: Inter-location movement, FIFO stock deduction, and concurrent double-receipt prevention (`transfer.test.ts`).
- **Customer Orders**: Multi-line batch reservations and atomic stock release (`order.test.ts`).

### 2. Verify Frontend Production Build
To ensure all TypeScript types and Vite bundles build with **0 errors**:
```bash
cd frontend
npm run build
```

---

## 📊 Core Business Logic & Prevention Rules

| Module | Core Logic & System Prevention Rules | Formula / Constraint |
| :--- | :--- | :--- |
| **Inventory** | **Formula**: `Available = Physical - Reserved`.<br>**Prevention**: Rejects negative physical stock, invalid quantity inputs, and duplicate batch creation per `(itemId, locationId, batch)`. | `Available = Physical - Reserved` |
| **Work Orders** | **Formula**: `Shortage = max(0, Required - Available)`.<br>**Prevention**: Enforces strict state machine transitions (`ASSIGNED -> IN_PROGRESS -> COMPLETED`). Direct transition to `COMPLETED` is rejected. | `Shortage = Math.max(0, Required - Available)` |
| **Stock Transfers** | **Three-Phase Flow**: `Requested -> Dispatched -> Received`.<br>**Prevention**: On dispatch, source stock reduces via FIFO. Destination stock is untouched until receipt. Double-receipt is rejected (`409 Conflict`). | `Remaining = max(0, Quantity - Received)` |
| **Customer Orders** | **Multi-Line Reservation**: All-or-nothing batch reservation.<br>**Prevention**: Atomic SQL updates prevent concurrent over-reservation (`(physical - reserved) >= quantity`). Re-allocates reserved stock upon cancellation. | `Atomic SQL UPDATE ... WHERE (physical - reserved) >= qty` |

---

## 📝 Demo User Credentials

The application includes pre-configured demo user accounts:

| Role | Email | Password | Assigned Location |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@minerp.local` | `password123` | Warehouse A (Main) |
| **Operations Lead** | `ops@minerp.local` | `password123` | Warehouse A (Main) |
| **Sales Representative** | `sales@minerp.local` | `password123` | Warehouse B (Secondary) |

*(Quick-login buttons are available directly on the login screen).*
