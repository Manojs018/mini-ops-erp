import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, Plus, Filter, RefreshCw, ArrowLeftRight, Send, PackageCheck } from 'lucide-react';
import { StockTransfer, StockTransferStatus } from '../types';
import { transfersApi } from '../api/transfers.api';
import { inventoryApi } from '../api/inventory.api';
import { DataTable, Column } from '../components/common/DataTable';
import { StatusBadge } from '../components/common/StatusBadge';
import { RoleGuard } from '../components/common/RoleGuard';
import { CreateTransferModal } from '../components/transfers/CreateTransferModal';
import { ReceiveStockModal } from '../components/transfers/ReceiveStockModal';
import { TransferDetailDrawer } from '../components/transfers/TransferDetailDrawer';
import { useToast } from '../components/common/Toast';

export const TransfersPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StockTransferStatus | ''>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [receivingTransfer, setReceivingTransfer] = useState<StockTransfer | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);

  // Check URL query parameters (e.g. from Work Order shortage alert link!)
  const queryCreate = searchParams.get('create');
  const queryItemId = searchParams.get('itemId') || undefined;
  const queryQty = searchParams.get('qty') ? Number(searchParams.get('qty')) : undefined;

  useEffect(() => {
    if (queryCreate === 'true') {
      setIsCreateOpen(true);
    }
  }, [queryCreate]);

  // Fetch Transfers
  const { data: transferData, isLoading, refetch } = useQuery({
    queryKey: ['transfers', page, statusFilter],
    queryFn: () =>
      transfersApi.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
      }),
  });

  // Fetch reference lists for Create Modal
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory', 'transferDropdowns'],
    queryFn: () => inventoryApi.list({ limit: 100 }),
  });

  const rawList = transferData?.data || [];
  const rawStock = inventoryData?.data || [];

  const uniqueItems = Array.from(
    new Map(rawStock.filter((s) => s.item).map((s) => [s.itemId, { id: s.itemId, name: s.item!.name, sku: s.item!.sku }])).values()
  );

  const uniqueLocations = Array.from(
    new Map(rawStock.filter((s) => s.location).map((s) => [s.locationId, { id: s.locationId, name: s.location!.name }])).values()
  );

  // Search filter
  const filteredList = rawList.filter((tf) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      tf.item?.name.toLowerCase().includes(q) ||
      tf.item?.sku.toLowerCase().includes(q) ||
      tf.sourceLocation?.name.toLowerCase().includes(q) ||
      tf.destinationLocation?.name.toLowerCase().includes(q)
    );
  });

  // Dispatch Action Handler
  const handleDispatchDirect = async (transfer: StockTransfer) => {
    try {
      const idempotencyKey = `dsp-${transfer.id}-${Date.now()}`;
      await transfersApi.dispatch(transfer.id, idempotencyKey);
      toast.success('Dispatched', 'Stock deducted from source warehouse.');
      refetch();
    } catch (err) {
      toast.error('Dispatch Failed', 'Insufficient stock or invalid state.');
    }
  };

  // Table Columns Setup
  const columns: Column<StockTransfer>[] = [
    {
      header: 'Transfer Ref',
      cell: (row) => (
        <div>
          <h4 className="font-bold text-slate-900 dark:text-slate-100">{row.id.slice(0, 8)}</h4>
          <p className="text-[11px] text-slate-400 font-mono">Date: {new Date(row.createdAt).toLocaleDateString()}</p>
        </div>
      ),
    },
    {
      header: 'Item',
      cell: (row) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.item?.name || 'Item'}</span>
          <p className="text-[11px] text-slate-400 font-mono">SKU: {row.item?.sku || 'N/A'}</p>
        </div>
      ),
    },
    {
      header: 'Source → Destination',
      cell: (row) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
          {row.sourceLocation?.name || row.sourceLocationId} →{' '}
          <strong className="text-indigo-600 dark:text-indigo-400">
            {row.destinationLocation?.name || row.destinationLocationId}
          </strong>
        </span>
      ),
    },
    {
      header: 'Qty (Recv / Total)',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
          {row.receivedQty} / {row.quantity}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      header: 'Actions',
      cell: (row) => (
        <RoleGuard allowedRoles={['ADMIN', 'OPERATIONS']}>
          <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
            {row.status === 'REQUESTED' && (
              <button
                onClick={() => handleDispatchDirect(row)}
                className="flex items-center space-x-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <Send className="h-3 w-3" />
                <span>Dispatch</span>
              </button>
            )}

            {(row.status === 'DISPATCHED' || row.status === 'PARTIALLY_RECEIVED') && (
              <button
                onClick={() => setReceivingTransfer(row)}
                className="flex items-center space-x-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <PackageCheck className="h-3 w-3" />
                <span>Receive</span>
              </button>
            )}
          </div>
        </RoleGuard>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Internal Stock Transfers</h1>
          <p className="text-xs text-slate-500">
            Request, dispatch, and receive stock movements across warehouse locations.
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

          <RoleGuard allowedRoles={['ADMIN', 'OPERATIONS']}>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center space-x-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Request Stock Transfer</span>
            </button>
          </RoleGuard>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {(['', 'REQUESTED', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'RECEIVED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === st
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {st === '' ? 'All Transfers' : st.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search transfer, item or location..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredList}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No stock transfers found matching your filters."
        pagination={transferData?.pagination}
        onPageChange={(p) => setPage(p)}
        onRowClick={(row) => setSelectedTransfer(row)}
      />

      {/* Create Modal */}
      <CreateTransferModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
        locations={uniqueLocations}
        items={uniqueItems}
        initialItemId={queryItemId}
        initialQty={queryQty}
      />

      {/* Receive Modal */}
      <ReceiveStockModal
        transfer={receivingTransfer}
        isOpen={!!receivingTransfer}
        onClose={() => setReceivingTransfer(null)}
        onSuccess={() => refetch()}
      />

      {/* Slide-Over Drawer */}
      <TransferDetailDrawer
        transfer={selectedTransfer}
        isOpen={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        onSuccess={() => refetch()}
        onOpenReceive={(tf) => setReceivingTransfer(tf)}
      />
    </div>
  );
};
