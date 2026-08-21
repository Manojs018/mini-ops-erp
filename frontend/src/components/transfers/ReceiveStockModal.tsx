import React, { useState } from 'react';
import { X, PackageCheck, AlertCircle } from 'lucide-react';
import { StockTransfer } from '../../types';
import { transfersApi } from '../../api/transfers.api';
import { getErrorMessage } from '../../api/axios';
import { useToast } from '../common/Toast';

interface ReceiveStockModalProps {
  transfer: StockTransfer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReceiveStockModal: React.FC<ReceiveStockModalProps> = ({
  transfer,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [rxQuantity, setRxQuantity] = useState<number | ''>('');
  const [isFullReceipt, setIsFullReceipt] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !transfer) return null;

  const remaining = transfer.remainingQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let qtyToSend: number | undefined = undefined;
    if (!isFullReceipt) {
      if (rxQuantity === '' || Number(rxQuantity) <= 0) {
        setError('Please enter a positive integer partial receipt quantity.');
        return;
      }
      if (Number(rxQuantity) > remaining) {
        setError(`Partial receipt quantity (${rxQuantity}) cannot exceed remaining balance of ${remaining}.`);
        return;
      }
      qtyToSend = Number(rxQuantity);
    }

    setIsLoading(true);
    setError(null);

    try {
      const idempotencyKey = `rcv-${transfer.id}-${Date.now()}`;
      await transfersApi.receive(transfer.id, qtyToSend, idempotencyKey);

      toast.success(
        'Stock Received',
        `Successfully received ${qtyToSend ?? remaining} units into destination warehouse.`
      );
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
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <PackageCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Receive Stock Transfer</h3>
              <p className="text-[11px] text-slate-500">Destination: {transfer.destinationLocation?.name || transfer.destinationLocationId}</p>
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40 text-xs">
            <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300">
              <span>Total Transfer Qty: <strong>{transfer.quantity}</strong></span>
              <span>Already Received: <strong className="text-purple-600">{transfer.receivedQty}</strong></span>
            </div>
            <div className="mt-1 flex justify-between font-bold text-emerald-600">
              <span>Remaining Balance:</span>
              <span>{remaining} units</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <input
                type="radio"
                id="full"
                name="rcvType"
                checked={isFullReceipt}
                onChange={() => setIsFullReceipt(true)}
                className="h-4 w-4 text-emerald-600"
              />
              <label htmlFor="full" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Full Receipt (Receive entire remaining balance of {remaining} units)
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="radio"
                id="partial"
                name="rcvType"
                checked={!isFullReceipt}
                onChange={() => setIsFullReceipt(false)}
                className="h-4 w-4 text-emerald-600"
              />
              <label htmlFor="partial" className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Partial Receipt (Specify custom quantity)
              </label>
            </div>
          </div>

          {!isFullReceipt && (
            <div className="space-y-1.5 pl-7">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Partial Quantity</label>
              <input
                type="number"
                min="1"
                max={remaining}
                value={rxQuantity}
                onChange={(e) => setRxQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={`Max ${remaining}`}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
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
              disabled={isLoading}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Confirm Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
