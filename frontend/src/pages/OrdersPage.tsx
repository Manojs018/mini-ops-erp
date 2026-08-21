import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Filter, RefreshCw, ShoppingCart, Ban } from 'lucide-react';
import { CustomerOrder, CustomerOrderStatus } from '../types';
import { ordersApi } from '../api/orders.api';
import { inventoryApi } from '../api/inventory.api';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { RoleGuard } from '../components/common/RoleGuard';
import { useAuth } from '../context/AuthContext';
import { CreateOrderModal } from '../components/orders/CreateOrderModal';
import { OrderDetailDrawer } from '../components/orders/OrderDetailDrawer';
import { useToast } from '../components/common/Toast';

export const OrdersPage: React.FC = () => {
  const { user, role } = useAuth();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CustomerOrderStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);

  // Fetch Orders
  const { data: orderData, isLoading, refetch } = useQuery({
    queryKey: ['orders', page, statusFilter],
    queryFn: () =>
      ordersApi.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
        all: role === 'ADMIN' ? true : undefined,
      }),
  });

  // Fetch Inventory Stock Batches for multi-line order builder
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', 'orderStockBatches'],
    queryFn: () => inventoryApi.list({ limit: 100 }),
  });

  const rawList = orderData?.data || [];
  const stockBatches = (inventoryData?.data || []).filter((s) => s.availableQty > 0);

  // Search filter
  const filteredList = rawList.filter((ord) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      ord.customerName.toLowerCase().includes(q) ||
      ord.salesUser?.name.toLowerCase().includes(q) ||
      ord.lines.some((l) => l.item?.name.toLowerCase().includes(q) || l.item?.sku.toLowerCase().includes(q))
    );
  });

  // Cancel order shortcut
  const handleCancelDirect = async (order: CustomerOrder) => {
    try {
      await ordersApi.cancel(order.id);
      toast.success('Cancelled', 'Reserved stock released back to available inventory.');
      refetch();
    } catch {
      toast.error('Cancellation Failed', 'Order state invalid or permission denied.');
    }
  };

  // Columns Setup
  const columns: Column<CustomerOrder>[] = [
    {
      header: 'Order Ref',
      cell: (row) => (
        <div>
          <h4 className="font-bold text-slate-900 dark:text-slate-100">{row.id.slice(0, 8)}</h4>
          <p className="text-[11px] text-slate-400 font-mono">Date: {new Date(row.createdAt).toLocaleDateString()}</p>
        </div>
      ),
    },
    {
      header: 'Customer Name',
      cell: (row) => <span className="font-semibold text-slate-900 dark:text-slate-100">{row.customerName}</span>,
    },
    {
      header: 'Sales Representative',
      cell: (row) => <span className="text-xs text-slate-700 dark:text-slate-300">{row.salesUser?.name || row.salesUserId}</span>,
    },
    {
      header: 'Total Reserved Lines',
      cell: (row) => {
        const total = row.lines.reduce((sum, l) => sum + l.quantity, 0);
        return (
          <span className="font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">
            {row.lines.length} lines ({total} units)
          </span>
        );
      },
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: 'Actions',
      cell: (row) => {
        const isOwner = user?.id === row.salesUserId;
        const canCancel = role === 'ADMIN' || (role === 'SALES' && isOwner);

        if (row.status === 'RESERVED' && canCancel) {
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => handleCancelDirect(row)}
                className="flex items-center space-x-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <Ban className="h-3 w-3" />
                <span>Cancel</span>
              </button>
            </div>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Customer Orders</h1>
          <p className="text-xs text-slate-500">
            All-or-nothing multi-line customer stock reservations and atomic cancellation release engine.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => refetch()}
            className="flex items-center space-x-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>

          <RoleGuard allowedRoles={['SALES', 'ADMIN']}>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center space-x-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create Customer Order</span>
            </button>
          </RoleGuard>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {(['', 'RESERVED', 'CANCELLED', 'FULFILLED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {st === '' ? 'All Orders' : st}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search customer or order ref..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredList}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No customer orders found matching your filters."
        pagination={orderData?.pagination}
        onPageChange={(p) => setPage(p)}
        onRowClick={(row) => setSelectedOrder(row)}
      />

      {/* Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
        availableStockBatches={stockBatches}
      />

      {/* Detail Slide-Over Drawer */}
      <OrderDetailDrawer
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
