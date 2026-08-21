import React, { useState } from 'react';
import type { StockTransfer } from '../../types';
import { DetailDrawer } from '../common/DetailDrawer';
import { StatusBadge } from '../common/StatusBadge';
import { RoleGuard } from '../../router/RoleGuard';
import { transfersApi } from '../../api/transfers.api';
import { getErrorMessage } from '../../api/axios';
import { useToast } from '../common/Toast';
import { MapPin, ArrowRight, PackageCheck, Send, AlertCircle } from 'lucide-react';

interface TransferDetailDrawerProps {
  transfer: StockTransfer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onOpenReceive: (transfer: StockTransfer) => void;
}

export const TransferDetailDrawer: React.FC<TransferDetailDrawerProps> = ({
  transfer,
  isOpen,
  onClose,
  onSuccess,
  onOpenReceive,
}) => {
  const toast = useToast();
  const [isDispatching, setIsDispatching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!transfer) return null;

  const handleDispatch = async () => {
    setIsDispatching(true);
    setError(null);
    try {
      const idempotencyKey = `dsp-${transfer.id}-${Date.now()}`;
      await transfersApi.dispatch(transfer.id, idempotencyKey);
      toast.success('Transfer Dispatched', 'Source stock deducted (FIFO) and transfer moved to DISPATCHED state.');
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsDispatching(false);
    }
  };

  const progressPct = Math.round((transfer.receivedQty / (transfer.quantity || 1)) * 100);

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Stock Transfer ${transfer.id.slice(0, 8)}`}
      subtitle={`Created ${new Date(transfer.createdAt).toLocaleDateString()}`}
    >
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
            <div className="mt-1">
              <StatusBadge status={transfer.status} size="md" />
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quantity</span>
            <p className="text-base font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {transfer.quantity} units
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 3-Phase Flow Timeline Visualizer */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Transfer Route Flow</h4>

          <div className="flex items-center justify-between text-xs font-semibold">
            {/* Source Node */}
            <div className="flex flex-col items-center text-center space-y-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <MapPin className="h-4 w-4" />
              </div>
              <span className="text-[11px] text-slate-900 dark:text-slate-100 font-bold">
                {transfer.sourceLocation?.name || transfer.sourceLocationId}
              </span>
              <span className="text-[10px] text-slate-400">Source</span>
            </div>

            <ArrowRight className="h-4 w-4 text-indigo-500 shrink-0" />

            {/* In-Transit Status Node */}
            <div className="flex flex-col items-center text-center space-y-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  transfer.status === 'DISPATCHED' || transfer.status === 'PARTIALLY_RECEIVED'
                    ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                }`}
              >
                <Send className="h-4 w-4" />
              </div>
              <span className="text-[11px] text-slate-900 dark:text-slate-100 font-bold">
                {transfer.status === 'REQUESTED' ? 'Pending' : 'In Transit'}
              </span>
              <span className="text-[10px] text-slate-400">Transit</span>
            </div>

            <ArrowRight className="h-4 w-4 text-indigo-500 shrink-0" />

            {/* Destination Node */}
            <div className="flex flex-col items-center text-center space-y-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  transfer.status === 'RECEIVED'
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                }`}
              >
                <PackageCheck className="h-4 w-4" />
              </div>
              <span className="text-[11px] text-slate-900 dark:text-slate-100 font-bold">
                {transfer.destinationLocation?.name || transfer.destinationLocationId}
              </span>
              <span className="text-[10px] text-slate-400">Destination</span>
            </div>
          </div>

          {/* Progress Bar for Partial Receipt */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-500">Receipt Progress</span>
              <span className="text-indigo-600 dark:text-indigo-400">
                {transfer.receivedQty} / {transfer.quantity} units ({progressPct}%)
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                style={{ width: `${progressPct}%` }}
                className="h-full bg-indigo-600 transition-all duration-500"
              />
            </div>
          </div>
        </div>

        {/* Item Specification */}
        <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex justify-between">
            <span className="text-slate-500">Transferred Item</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {transfer.item?.name} ({transfer.item?.sku})
            </span>
          </div>
          {transfer.dispatchedAt && (
            <div className="flex justify-between">
              <span className="text-slate-500">Dispatched At</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">
                {new Date(transfer.dispatchedAt).toLocaleString()}
              </span>
            </div>
          )}
          {transfer.receivedAt && (
            <div className="flex justify-between">
              <span className="text-slate-500">Completed At</span>
              <span className="font-mono text-slate-600 dark:text-slate-400">
                {new Date(transfer.receivedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Role-Aware Action Controls */}
        <RoleGuard allowedRoles={['ADMIN', 'OPERATIONS']}>
          <div className="space-y-2.5 border-t border-slate-200 pt-5 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transfer Actions</h4>

            {transfer.status === 'REQUESTED' && (
              <button
                onClick={handleDispatch}
                disabled={isDispatching}
                className="flex w-full items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>{isDispatching ? 'Dispatching...' : 'Dispatch Transfer (Deduct Source Stock)'}</span>
              </button>
            )}

            {(transfer.status === 'DISPATCHED' || transfer.status === 'PARTIALLY_RECEIVED') && (
              <button
                onClick={() => {
                  onClose();
                  onOpenReceive(transfer);
                }}
                className="flex w-full items-center justify-center space-x-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
              >
                <PackageCheck className="h-4 w-4" />
                <span>Receive Stock (Full or Partial)</span>
              </button>
            )}
          </div>
        </RoleGuard>
      </div>
    </DetailDrawer>
  );
};
