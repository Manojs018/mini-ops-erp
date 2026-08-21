import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Filter, RefreshCw, MapPin } from 'lucide-react';
import type { InventoryStock } from '../types';
import { inventoryApi } from '../api/inventory.api';
import { DataTable, type Column } from '../components/common/DataTable';
import { QuantityBadge } from '../components/common/QuantityBadge';
import { RoleGuard } from '../router/RoleGuard';
import { AddInventoryModal } from '../components/inventory/AddInventoryModal';
import { AdjustStockModal } from '../components/inventory/AdjustStockModal';
import { ReportDamageModal } from '../components/inventory/ReportDamageModal';
import { InventoryDetailDrawer } from '../components/inventory/InventoryDetailDrawer';

export const InventoryPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationIdFilter, setLocationIdFilter] = useState('');
  const [selectedStock, setSelectedStock] = useState<InventoryStock | null>(null);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [adjustingStock, setAdjustingStock] = useState<InventoryStock | null>(null);
  const [damagingStock, setDamagingStock] = useState<InventoryStock | null>(null);

  // Fetch Inventory List
  const { data: inventoryData, isLoading, refetch } = useQuery({
    queryKey: ['inventory', page, locationIdFilter],
    queryFn: () => inventoryApi.list({ page, limit: 10, locationId: locationIdFilter || undefined }),
  });

  const rawList = inventoryData?.data || [];

  // Client-side search filter for item name, SKU, or batch
  const filteredList = rawList.filter((stock) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      stock.item?.name.toLowerCase().includes(q) ||
      stock.item?.sku.toLowerCase().includes(q) ||
      stock.batch.toLowerCase().includes(q) ||
      stock.location?.name.toLowerCase().includes(q)
    );
  });

  // Extract unique items & locations from existing list for modal dropdowns
  const uniqueItems = Array.from(
    new Map(
      rawList
        .filter((s) => s.item)
        .map((s) => [s.itemId, { id: s.itemId, name: s.item!.name, sku: s.item!.sku }])
    ).values()
  );

  const uniqueLocations = Array.from(
    new Map(
      rawList
        .filter((s) => s.location)
        .map((s) => [s.locationId, { id: s.locationId, name: s.location!.name }])
    ).values()
  );

  // Table Columns Setup
  const columns: Column<InventoryStock>[] = [
    {
      header: 'Item & SKU',
      cell: (row) => (
        <div>
          <h4 className="font-bold text-slate-900 dark:text-slate-100">{row.item?.name || 'Item'}</h4>
          <p className="text-[11px] text-slate-400 font-mono">SKU: {row.item?.sku || 'N/A'}</p>
        </div>
      ),
    },
    {
      header: 'Location',
      cell: (row) => (
        <span className="inline-flex items-center space-x-1.5 text-xs text-slate-700 dark:text-slate-300">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span>{row.location?.name || row.locationId}</span>
        </span>
      ),
    },
    {
      header: 'Batch Code',
      cell: (row) => (
        <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
          {row.batch}
        </span>
      ),
    },
    {
      header: 'Physical Stock',
      cell: (row) => <QuantityBadge value={row.physicalQty} type="physical" size="sm" />,
    },
    {
      header: 'Reserved Stock',
      cell: (row) => <QuantityBadge value={row.reservedQty} type="reserved" size="sm" />,
    },
    {
      header: 'Available Stock',
      cell: (row) => <QuantityBadge value={row.availableQty} type="available" size="sm" />,
    },
    {
      header: 'Actions',
      cell: (row) => (
        <RoleGuard allowedRoles={['ADMIN', 'OPERATIONS']}>
          <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setAdjustingStock(row)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Adjust
            </button>
            <button
              onClick={() => setDamagingStock(row)}
              className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              Damage
            </button>
          </div>
        </RoleGuard>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Controls Bar */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Inventory & Stock Batches
          </h1>
          <p className="text-xs text-slate-500">
            Dynamic stock tracking, physical stock adjustments, and damage reporting.
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
              onClick={() => setIsAddOpen(true)}
              className="flex items-center space-x-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Add Stock Batch</span>
            </button>
          </RoleGuard>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search SKU, item or batch..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span>Location:</span>
          </div>
          <select
            value={locationIdFilter}
            onChange={(e) => {
              setLocationIdFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="">All Locations</option>
            {uniqueLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Stock Data Table */}
      <DataTable
        columns={columns}
        data={filteredList}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No stock records found matching your filters."
        pagination={inventoryData?.pagination}
        onPageChange={(p) => setPage(p)}
        onRowClick={(row) => setSelectedStock(row)}
      />

      {/* Add Stock Modal */}
      <AddInventoryModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={() => refetch()}
        items={uniqueItems}
        locations={uniqueLocations}
      />

      {/* Adjust Stock Modal */}
      <AdjustStockModal
        stock={adjustingStock}
        isOpen={!!adjustingStock}
        onClose={() => setAdjustingStock(null)}
        onSuccess={() => refetch()}
      />

      {/* Report Damage Modal */}
      <ReportDamageModal
        stock={damagingStock}
        isOpen={!!damagingStock}
        onClose={() => setDamagingStock(null)}
        onSuccess={() => refetch()}
      />

      {/* Detail Slide-Over Drawer */}
      <InventoryDetailDrawer
        stock={selectedStock}
        isOpen={!!selectedStock}
        onClose={() => setSelectedStock(null)}
        onAdjust={(s) => setAdjustingStock(s)}
        onReportDamage={(s) => setDamagingStock(s)}
      />
    </div>
  );
};
