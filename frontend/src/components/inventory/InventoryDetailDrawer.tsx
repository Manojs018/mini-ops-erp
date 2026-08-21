import React from 'react';
import { InventoryStock } from '../../types';
import { DetailDrawer } from '../common/DetailDrawer';
import { QuantityBadge } from '../common/QuantityBadge';
import { RoleGuard } from '../common/RoleGuard';
import { Sliders, ShieldAlert, Boxes, MapPin, Tag } from 'lucide-react';

interface InventoryDetailDrawerProps {
  stock: InventoryStock | null;
  isOpen: boolean;
  onClose: () => void;
  onAdjust: (stock: InventoryStock) => void;
  onReportDamage: (stock: InventoryStock) => void;
}

export const InventoryDetailDrawer: React.FC<InventoryDetailDrawerProps> = ({
  stock,
  isOpen,
  onClose,
  onAdjust,
  onReportDamage,
}) => {
  if (!stock) return null;

  const total = stock.physicalQty > 0 ? stock.physicalQty : 1;
  const reservedPct = Math.round((stock.reservedQty / total) * 100);
  const availablePct = Math.round((stock.availableQty / total) * 100);

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={stock.item?.name || 'Stock Batch Detail'}
      subtitle={`SKU: ${stock.item?.sku || 'N/A'} • Batch: ${stock.batch}`}
    >
      <div className="space-y-6">
        {/* Core Stock Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40 text-center">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Physical</span>
            <div className="mt-1">
              <QuantityBadge value={stock.physicalQty} type="physical" size="md" />
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reserved</span>
            <div className="mt-1">
              <QuantityBadge value={stock.reservedQty} type="reserved" size="md" />
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available</span>
            <div className="mt-1">
              <QuantityBadge value={stock.availableQty} type="available" size="md" />
            </div>
          </div>
        </div>

        {/* Visual Progress Bar Meter */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
            <span>Availability Meter</span>
            <span>{availablePct}% Free</span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              style={{ width: `${availablePct}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Available: ${stock.availableQty}`}
            />
            <div
              style={{ width: `${reservedPct}%` }}
              className="bg-sky-500 transition-all duration-500"
              title={`Reserved: ${stock.reservedQty}`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Available ({stock.availableQty})</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              <span>Reserved ({stock.reservedQty})</span>
            </span>
          </div>
        </div>

        {/* Metadata Listing */}
        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Batch Specifications</h4>
          <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-2 text-slate-500">
                <MapPin className="h-4 w-4" />
                <span>Location</span>
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{stock.location?.name || stock.locationId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-2 text-slate-500">
                <Tag className="h-4 w-4" />
                <span>Category</span>
              </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{stock.item?.category?.name || 'General'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-2 text-slate-500">
                <Boxes className="h-4 w-4" />
                <span>Batch Code</span>
              </span>
              <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{stock.batch}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Optimistic Version</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">v{stock.version}</span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons for ADMIN & OPERATIONS */}
        <RoleGuard allowedRoles={['ADMIN', 'OPERATIONS']}>
          <div className="space-y-2.5 border-t border-slate-200 pt-5 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Management Actions</h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  onClose();
                  onAdjust(stock);
                }}
                className="flex items-center justify-center space-x-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Sliders className="h-4 w-4 text-amber-500" />
                <span>Adjust Stock</span>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onReportDamage(stock);
                }}
                className="flex items-center justify-center space-x-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs font-semibold text-rose-700 shadow-2xs hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
              >
                <ShieldAlert className="h-4 w-4 text-rose-500" />
                <span>Report Damage</span>
              </button>
            </div>
          </div>
        </RoleGuard>
      </div>
    </DetailDrawer>
  );
};
