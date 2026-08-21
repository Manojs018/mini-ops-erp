import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { AppShell } from '../components/layout/AppShell';
import { Login } from '../pages/Login';
import { Dashboard } from '../pages/Dashboard';
import { InventoryPage } from '../pages/InventoryPage';
import { WorkOrdersPage } from '../pages/WorkOrdersPage';
import { TransfersPage } from '../pages/TransfersPage';
import { OrdersPage } from '../pages/OrdersPage';

export const AppRouter: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<Login />} />

        {/* Authenticated Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route
            path="/dashboard"
            element={
              <AppShell pageTitle="Operational Overview">
                <Dashboard />
              </AppShell>
            }
          />

          <Route
            path="/inventory"
            element={
              <AppShell pageTitle="Inventory Management">
                <InventoryPage />
              </AppShell>
            }
          />

          <Route
            path="/work-orders"
            element={
              <AppShell pageTitle="Work Order Tracking">
                <WorkOrdersPage />
              </AppShell>
            }
          />

          <Route
            path="/transfers"
            element={
              <AppShell pageTitle="Internal Stock Transfers">
                <TransfersPage />
              </AppShell>
            }
          />

          <Route
            path="/orders"
            element={
              <AppShell pageTitle="Customer Order Reservations">
                <OrdersPage />
              </AppShell>
            }
          />
        </Route>

        {/* Fallback Catch-all Route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
