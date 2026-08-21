import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Boxes,
  ClipboardList,
  ArrowLeftRight,
  ShoppingCart,
  TrendingUp,
  Plus,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { inventoryApi } from '../api/inventory.api';
import { workOrdersApi } from '../api/workOrders.api';
import { transfersApi } from '../api/transfers.api';
import { ordersApi } from '../api/orders.api';
import { RoleGuard } from '../router/RoleGuard';
import { QuantityBadge } from '../components/common/QuantityBadge';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();

  // Fetch Inventory Data
  const { data: inventoryData, isLoading: invLoading } = useQuery({
    queryKey: ['inventory', 'dashboard'],
    queryFn: () => inventoryApi.list({ limit: 100 }),
  });

  // Fetch Work Orders Data
  const { data: workOrdersData, isLoading: woLoading } = useQuery({
    queryKey: ['workOrders', 'dashboard'],
    queryFn: () => workOrdersApi.list({ limit: 100, all: true }),
  });

  // Fetch Transfers Data
  const { data: transfersData, isLoading: tfLoading } = useQuery({
    queryKey: ['transfers', 'dashboard'],
    queryFn: () => transfersApi.list({ limit: 100 }),
  });

  // Fetch Orders Data
  const { data: ordersData, isLoading: ordLoading } = useQuery({
    queryKey: ['orders', 'dashboard'],
    queryFn: () => ordersApi.list({ limit: 100, all: true }),
  });

  const isLoading = invLoading || woLoading || tfLoading || ordLoading;

  // Calculate Metrics from Real Backend API Data
  const inventoryList = inventoryData?.data || [];
  const totalPhysical = inventoryList.reduce((sum, item) => sum + item.physicalQty, 0);
  const totalReserved = inventoryList.reduce((sum, item) => sum + item.reservedQty, 0);
  const totalAvailable = inventoryList.reduce((sum, item) => sum + item.availableQty, 0);

  const workOrdersList = workOrdersData?.data || [];
  const assignedWOs = workOrdersList.filter((wo) => wo.status === 'ASSIGNED').length;
  const inProgressWOs = workOrdersList.filter((wo) => wo.status === 'IN_PROGRESS').length;
  const completedWOs = workOrdersList.filter((wo) => wo.status === 'COMPLETED').length;

  const transfersList = transfersData?.data || [];
  const requestedTfs = transfersList.filter((tf) => tf.status === 'REQUESTED').length;
  const dispatchedTfs = transfersList.filter((tf) => tf.status === 'DISPATCHED').length;
  const partiallyReceivedTfs = transfersList.filter((tf) => tf.status === 'PARTIALLY_RECEIVED').length;
  const receivedTfs = transfersList.filter((tf) => tf.status === 'RECEIVED').length;

  const ordersList = ordersData?.data || [];
  const reservedOrders = ordersList.filter((o) => o.status === 'RESERVED').length;
  const cancelledOrders = ordersList.filter((o) => o.status === 'CANCELLED').length;

  // Recharts Chart Data
  const woChartData = [
    { name: 'Assigned', value: assignedWOs, color: '#3b82f6' },
    { name: 'In Progress', value: inProgressWOs, color: '#f59e0b' },
    { name: 'Completed', value: completedWOs, color: '#10b981' },
  ];

  const tfChartData = [
    { name: 'Requested', count: requestedTfs },
    { name: 'Dispatched', count: dispatchedTfs },
    { name: 'Partial', count: partiallyReceivedTfs },
    { name: 'Received', count: receivedTfs },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-lg dark:border-slate-800">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 rounded-lg bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 backdrop-blur-xs">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Operations Live Overview</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Welcome back, {user?.name || 'Operator'}
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Real-time operations command portal. Monitor live physical stock, work order status transitions, internal transfers in transit, and active customer reservations.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Inventory */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Stock Records
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {isLoading ? '...' : inventoryList.length}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">stock batches</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>Physical: <strong className="text-slate-700 dark:text-slate-300">{totalPhysical.toLocaleString()}</strong></span>
            <span>Available: <strong className="text-emerald-600 dark:text-emerald-400">{totalAvailable.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Card 2: Work Orders */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Work Orders
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {isLoading ? '...' : assignedWOs + inProgressWOs}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">in pipeline</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>Assigned: <strong className="text-blue-600">{assignedWOs}</strong></span>
            <span>In Progress: <strong className="text-amber-600">{inProgressWOs}</strong></span>
          </div>
        </div>

        {/* Card 3: Transfers */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Transfers in Transit
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {isLoading ? '...' : dispatchedTfs + partiallyReceivedTfs}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">active movements</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>Dispatched: <strong className="text-indigo-600">{dispatchedTfs}</strong></span>
            <span>Partial Rx: <strong className="text-purple-600">{partiallyReceivedTfs}</strong></span>
          </div>
        </div>

        {/* Card 4: Customer Reservations */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Reservations
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline space-x-2">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              {isLoading ? '...' : reservedOrders}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">reserved orders</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span>Reserved Qty: <strong className="text-sky-600">{totalReserved.toLocaleString()}</strong></span>
            <span>Cancelled: <strong className="text-slate-400">{cancelledOrders}</strong></span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Work Order Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Work Order Pipeline</h3>
              <p className="text-xs text-slate-500">Distribution across state machine</p>
            </div>
            <Link
              to="/work-orders"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              View All →
            </Link>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={woChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {woChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center space-x-6 pt-2 text-xs font-medium">
            {woChartData.map((item) => (
              <div key={item.name} className="flex items-center space-x-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 dark:text-slate-300">{item.name}: <strong>{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Transfer Movements Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Transfer Status Overview</h3>
              <p className="text-xs text-slate-500">Stock movements across locations</p>
            </div>
            <Link
              to="/transfers"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              View All →
            </Link>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tfChartData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts & Recent Operational Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Quick Actions Shortcuts Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Operational Shortcuts</h3>
          <div className="space-y-3">
            <RoleGuard allowedRoles={['ADMIN']}>
              <Link
                to="/work-orders"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <span>Create Work Order</span>
                </div>
                <Plus className="h-4 w-4 text-slate-400" />
              </Link>
            </RoleGuard>

            <RoleGuard allowedRoles={['ADMIN', 'OPERATIONS']}>
              <Link
                to="/transfers"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                    <ArrowLeftRight className="h-4 w-4" />
                  </div>
                  <span>Request Transfer</span>
                </div>
                <Plus className="h-4 w-4 text-slate-400" />
              </Link>
            </RoleGuard>

            <RoleGuard allowedRoles={['SALES']}>
              <Link
                to="/orders"
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <span>Create Customer Order</span>
                </div>
                <Plus className="h-4 w-4 text-slate-400" />
              </Link>
            </RoleGuard>

            <Link
              to="/inventory"
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <div className="flex items-center space-x-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                  <Boxes className="h-4 w-4" />
                </div>
                <span>Inspect Inventory</span>
              </div>
              <Plus className="h-4 w-4 text-slate-400" />
            </Link>
          </div>
        </div>

        {/* Live Inventory Stock Feed */}
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Live Inventory Availability</h3>
            <Link to="/inventory" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
              View All →
            </Link>
          </div>

          <div className="space-y-3">
            {inventoryList.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800/60 dark:bg-slate-800/30"
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {item.item?.name || 'Item'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Loc: {item.location?.name || item.locationId} • Batch: {item.batch}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Available</span>
                    <div>
                      <QuantityBadge value={item.availableQty} type="available" size="sm" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
