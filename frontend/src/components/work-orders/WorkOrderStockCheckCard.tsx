import React, { useState } from 'react';
import { RefreshCw, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import type { StockCheck } from '../../types';
import { workOrdersApi } from '../../api/workOrders.api';
import { QuantityBadge } from '../common/QuantityBadge';
import { useNavigate } from 'react-router-dom';

interface WorkOrderStockCheckCardProps {
  workOrderId: string;
  initialStockCheck?: StockCheck;
  itemId?: string;
}

export const WorkOrderStockCheckCard: React.FC<WorkOrderStockCheckCardProps> = ({
  workOrderId,
  initialStockCheck,
  itemId,
}) => {
  const navigate = useNavigate();
  const [stockCheck, setStockCheck] = useState<StockCheck | undefined>(initialStockCheck);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const fresh = await workOrdersApi.getStockCheck(workOrderId);
      setStockCheck(fresh);
    } catch {
      // Ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  const shortage = stockCheck ? stockCheck.shortage : 0;
  const available = stockCheck ? stockCheck.availableQtyAtLocation : 0;
  const required = stockCheck ? stockCheck.requiredQty : 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-800/40 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Material Readiness & Shortage Check
          </h4>
          <p className="text-[11px] text-slate-500">Live calculation: max(0, Required - Available)</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Stock Check</span>
        </button>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Required Qty</span>
          <div className="mt-1">
            <QuantityBadge value={required} type="physical" size="md" />
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Available Stock</span>
          <div className="mt-1">
            <QuantityBadge value={available} type="available" size="md" />
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 shadow-2xs dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Shortage</span>
          <div className="mt-1">
            <QuantityBadge value={shortage} type="shortage" size="md" />
          </div>
        </div>
      </div>

      {/* Status Warning Alert */}
      {shortage > 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900/60 dark:bg-rose-950/40 space-y-2">
          <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <h5 className="text-xs font-bold">Shortage Warning: {shortage} units missing</h5>
          </div>
          <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-normal">
            Production cannot complete without additional material stock. Request an internal transfer from another warehouse location to fulfill this deficit.
          </p>
          <div className="pt-1">
            <button
              onClick={() => navigate(`/transfers?create=true&itemId=${itemId || ''}&qty=${shortage}`)}
              className="inline-flex items-center space-x-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-rose-500"
            >
              <span>Create Internal Transfer for Shortage ({shortage} units)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center space-x-2.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-xs font-medium">Sufficient stock available at location to proceed with work order.</span>
        </div>
      )}
    </div>
  );
};
