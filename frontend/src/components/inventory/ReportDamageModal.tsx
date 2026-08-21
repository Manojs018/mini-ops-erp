import React, { useState } from 'react';
import { X, ShieldAlert, AlertCircle } from 'lucide-react';
import { InventoryStock } from '../../types';
import { inventoryApi } from '../../api/inventory.api';
import { getErrorMessage } from '../../api/axios';
import { useToast } from '../common/Toast';

interface ReportDamageModalProps {
  stock: InventoryStock | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReportDamageModal: React.FC<ReportDamageModalProps> = ({
  stock,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !stock) return null;

  const dmgQty = Number(quantity);
  const maxAllowedDamage = stock.availableQty;
  const newAvailable = stock.availableQty - (isNaN(dmgQty) ? 0 : dmgQty);
  const isExceedingAvailable = dmgQty > stock.availableQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity === '' || dmgQty <= 0) {
      setError('Please enter a positive integer damaged quantity.');
      return;
    }

    if (isExceedingAvailable) {
      setError(`Cannot report damage of ${dmgQty} units. Only ${stock.availableQty} units available above currently reserved stock.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await inventoryApi.reportDamage(stock.id, {
        quantity: dmgQty,
        reason: reason.trim() || 'Damaged stock reported',
      });

      toast.success('Damage Reported', `${dmgQty} units marked as damaged for batch ${stock.batch}.`);
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Report Damaged Stock</h3>
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Damaged Quantity</label>
              <span className="text-[11px] font-semibold text-slate-500">
                Max Allowed: <strong className="text-emerald-600">{maxAllowedDamage}</strong>
              </span>
            </div>
            <input
              type="number"
              min="1"
              max={maxAllowedDamage}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder={`Max ${maxAllowedDamage}`}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Damage Reason / Description</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Forklift collision or water exposure"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Impact Preview */}
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
            <h4 className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider mb-2">
              Damage Impact Preview
            </h4>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-[10px] text-slate-500">Current Physical</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">{stock.physicalQty}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">Damaged Deduction</span>
                <p className="font-bold text-rose-600">-{dmgQty || 0}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-500">New Available</span>
                <p className={`font-bold ${newAvailable < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {isNaN(newAvailable) ? stock.availableQty : newAvailable}
                </p>
              </div>
            </div>
          </div>

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
              disabled={isLoading || isExceedingAvailable}
              className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-500 disabled:opacity-50"
            >
              {isLoading ? 'Reporting...' : 'Confirm Damage Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
