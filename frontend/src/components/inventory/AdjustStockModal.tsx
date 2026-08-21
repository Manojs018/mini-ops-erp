import React, { useState } from 'react';
import { X, Sliders, AlertCircle, AlertTriangle } from 'lucide-react';
import type { InventoryStock } from '../../types';
import { inventoryApi } from '../../api/inventory.api';
import { getErrorMessage } from '../../api/axios';
import { useToast } from '../common/Toast';

interface AdjustStockModalProps {
  stock: InventoryStock | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  stock,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [delta, setDelta] = useState<number | ''>('');
  const [direction, setDirection] = useState<'add' | 'deduct'>('add');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !stock) return null;

  const rawChange = Number(delta) * (direction === 'deduct' ? -1 : 1);
  const newPhysical = stock.physicalQty + rawChange;
  const newAvailable = newPhysical - stock.reservedQty;
  const isInvalidReduction = direction === 'deduct' && newPhysical < stock.reservedQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delta === '' || Number(delta) <= 0) {
      setError('Please enter a positive integer adjustment quantity.');
      return;
    }

    if (isInvalidReduction) {
      setError(`Cannot deduct quantity. Physical stock cannot fall below reserved quantity of ${stock.reservedQty}.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await inventoryApi.adjust(stock.id, {
        quantityChange: rawChange,
        reason: reason.trim() || 'Manual stock adjustment',
      });

      toast.success('Stock Adjusted', `Physical stock updated for batch ${stock.batch}.`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Adjust Physical Stock</h3>
              <p className="text-[11px] text-slate-500">Batch: {stock.batch}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center space-x-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDirection('add')}
              className={`rounded-xl border p-3 text-xs font-semibold transition-all ${
                direction === 'add'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800'
              }`}
            >
              + Receipt / Addition
            </button>
            <button
              type="button"
              onClick={() => setDirection('deduct')}
              className={`rounded-xl border p-3 text-xs font-semibold transition-all ${
                direction === 'deduct'
                  ? 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800'
              }`}
            >
              - Issue / Reduction
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quantity Delta</label>
            <input
              type="number"
              min="1"
              value={delta}
              onChange={(e) => setDelta(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 10"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reason / Notes</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Stock audit variance correction"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Adjustment Preview Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Impact Preview</h4>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-400">Current Phys</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{stock.physicalQty}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Adjustment</span>
                <p className={`font-bold ${direction === 'add' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {direction === 'add' ? `+${delta || 0}` : `-${delta || 0}`}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">New Physical</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{isNaN(newPhysical) ? stock.physicalQty : newPhysical}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">New Available</span>
                <p className="font-bold text-emerald-600">{isNaN(newAvailable) ? stock.availableQty : newAvailable}</p>
              </div>
            </div>
          </div>

          {direction === 'deduct' && (
            <div className="flex items-center space-x-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Deducting stock reduces physical inventory permanently.</span>
            </div>
          )}

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || isInvalidReduction}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Updating...' : 'Submit Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
