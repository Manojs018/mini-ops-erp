import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Filter, RefreshCw, ClipboardList, AlertTriangle } from 'lucide-react';
import { WorkOrder, WorkOrderStatus } from '../types';
import { workOrdersApi } from '../api/workOrders.api';
import { inventoryApi } from '../api/inventory.api';
import { authApi } from '../api/auth.api';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { QuantityBadge } from '../components/common/QuantityBadge';
import { RoleGuard } from '../components/common/RoleGuard';
import { useAuth } from '../context/AuthContext';
import { CreateWorkOrderModal } from '../components/work-orders/CreateWorkOrderModal';
import { WorkOrderDetailModal } from '../components/work-orders/WorkOrderDetailModal';

export const WorkOrdersPage: React.FC = () => {
  const { user, role } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);

  // Fetch Work Orders
  const { data: woData, isLoading, refetch } = useQuery({
    queryKey: ['workOrders', page, statusFilter],
    queryFn: () =>
      workOrdersApi.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
        all: role === 'ADMIN' ? true : undefined,
      }),
  });

  // Fetch reference lists for Create Work Order dropdowns
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', 'dropdowns'],
    queryFn: () => inventoryApi.list({ limit: 100 }),
  });

  // Demo user options
  const sampleUsers = [
    { id: user?.id || 'admin-id', name: user?.name || 'Current User', role: user?.role || 'ADMIN' },
    { id: 'usr-ops-1', name: 'Ops Officer', role: 'OPERATIONS' },
    { id: 'usr-ops-2', name: 'Factory Manager', role: 'OPERATIONS' },
  ];

  const rawList = woData?.data || [];
  const rawStock = inventoryData?.data || [];

  const uniqueItems = Array.from(
    new Map(rawStock.filter((s) => s.item).map((s) => [s.itemId, { id: s.itemId, name: s.item!.name, sku: s.item!.sku }])).values()
  );

  const uniqueLocations = Array.from(
    new Map(rawStock.filter((s) => s.location).map((s) => [s.locationId, { id: s.locationId, name: s.location!.name }])).values()
  );

  // Client search filter
  const filteredList = rawList.filter((wo) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      wo.item?.name.toLowerCase().includes(q) ||
      wo.item?.sku.toLowerCase().includes(q) ||
      wo.location?.name.toLowerCase().includes(q) ||
      wo.assignedUser?.name.toLowerCase().includes(q)
    );
  });

  // Columns definition
  const columns: Column<WorkOrder>[] = [
    {
      header: 'WO Identifier',
      cell: (row) => (
        <div>
          <h4 className="font-bold text-slate-900 dark:text-slate-100">{row.id.slice(0, 8)}</h4>
          <p className="text-[11px] text-slate-400 font-mono">Created: {new Date(row.createdAt).toLocaleDateString()}</p>
        </div>
      ),
    },
    {
      header: 'Target Item & SKU',
      cell: (row) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.item?.name || 'Item'}</span>
          <p className="text-[11px] text-slate-400 font-mono">SKU: {row.item?.sku || 'N/A'}</p>
        </div>
      ),
    },
    {
      header: 'Location',
      cell: (row) => <span className="text-xs text-slate-700 dark:text-slate-300">{row.location?.name || row.locationId}</span>,
    },
    {
      header: 'Required Qty',
      cell: (row) => <QuantityBadge value={row.requiredQty} type="physical" size="sm" />,
    },
    {
      header: 'Assigned To',
      cell: (row) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {row.assignedUser?.name || row.assignedUserId}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: 'Shortage Warning',
      cell: (row) => {
        const shortage = row.stockCheck?.shortage ?? 0;
        if (shortage > 0) {
          return (
            <span className="inline-flex items-center space-x-1 rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertTriangle className="h-3 w-3" />
              <span>{shortage} Short</span>
            </span>
          );
        }
        return <span className="text-xs text-emerald-600 font-semibold">Ready</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Work Orders</h1>
          <p className="text-xs text-slate-500">
            Track production tasks, material shortage availability, and state machine transitions.
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

          <RoleGuard allowedRoles={['ADMIN']}>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Create Work Order</span>
            </button>
          </RoleGuard>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {(['', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {st === '' ? 'All Work Orders' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search WO, SKU or assigned..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredList}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No work orders found matching your search criteria."
        pagination={woData?.pagination}
        onPageChange={(p) => setPage(p)}
        onRowClick={(row) => setSelectedWO(row)}
      />

      {/* Create Modal */}
      <CreateWorkOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
        locations={uniqueLocations}
        items={uniqueItems}
        users={sampleUsers}
      />

      {/* Detail Slide-Over */}
      <WorkOrderDetailModal
        workOrder={selectedWO}
        isOpen={!!selectedWO}
        onClose={() => setSelectedWO(null)}
        onSuccess={() => refetch()}
      />
    </div>
  );
};
