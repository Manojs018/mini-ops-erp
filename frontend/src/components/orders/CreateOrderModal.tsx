import React, { useState } from 'react';
import { X, ShoppingCart, Plus, Trash2, AlertCircle, AlertTriangle } from 'lucide-react';
import { InventoryStock } from '../../types';
import { ordersApi, CreateOrderLineInput } from '../../api/orders.api';
import { getErrorMessage } from '../../api/axios';
import { useToast } from '../common/Toast';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableStockBatches: InventoryStock[];
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  availableStockBatches,
}) => {
  const toast = useToast();
  const [customerName, setCustomerName] = useState('');
  const [lines, setLines] = useState<{ inventoryStockId: string; quantity: number | '' }[]>([
    { inventoryStockId: '', quantity: '' },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddLine = () => {
    setLines((prev) => [...prev, { inventoryStockId: '', quantity: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: 'inventoryStockId' | 'quantity', value: any) => {
    setLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Client validation for duplicates and available quantity bounds
  const stockMap = new Map(availableStockBatches.map((s) => [s.id, s]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Please enter customer name.');
      return;
    }

    const selectedStockIds = new Set<string>();
    const formattedLines: CreateOrderLineInput[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.inventoryStockId || line.quantity === '' || Number(line.quantity) <= 0) {
        setError(`Line #${i + 1}: Please select a stock batch and enter a positive quantity.`);
        return;
      }

      if (selectedStockIds.has(line.inventoryStockId)) {
        setError(`Duplicate stock batch selected on Line #${i + 1}. Each batch can only be selected once per order.`);
        return;
      }
      selectedStockIds.add(line.inventoryStockId);

      const stockItem = stockMap.get(line.inventoryStockId);
      if (stockItem && Number(line.quantity) > stockItem.availableQty) {
        setError(
          `Line #${i + 1}: Quantity (${line.quantity}) exceeds available stock (${stockItem.availableQty}) for batch ${stockItem.batch}.`
        );
        return;
      }

      formattedLines.push({
        inventoryStockId: line.inventoryStockId,
        quantity: Number(line.quantity),
      });
    }

    setIsLoading(true);
    setError(null);

    try {
      await ordersApi.create({
        customerName: customerName.trim(),
        lines: formattedLines,
      });

      toast.success('Order Placed', 'Customer order reserved successfully under all-or-nothing transaction.');
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
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <ShoppingCart className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Create Customer Order</h3>
              <p className="text-[11px] text-slate-500">All-or-Nothing Multi-Line Reservation</p>
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
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Customer Name</label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Acme Logistics Corp"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-2xs focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Multi-Line Order Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Items / Lines</label>
              <button
                type="button"
                onClick={handleAddLine}
                className="flex items-center space-x-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Line</span>
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {lines.map((line, idx) => {
                const selectedStock = stockMap.get(line.inventoryStockId);
                return (
                  <div
                    key={idx}
                    className="flex items-center space-x-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/40"
                  >
                    <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>

                    <div className="flex-1 space-y-1">
                      <select
                        value={line.inventoryStockId}
                        onChange={(e) => handleLineChange(idx, 'inventoryStockId', e.target.value)}
                        required
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-2xs focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">-- Choose Stock Batch --</option>
                        {availableStockBatches.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.item?.name} ({s.item?.sku}) • {s.location?.name} • Batch: {s.batch} (Avail: {s.availableQty})
                          </option>
                        ))}
                      </select>
                      {selectedStock && (
                        <p className="text-[10px] text-emerald-600 font-semibold pl-1">
                          Available: {selectedStock.availableQty} units
                        </p>
                      )}
                    </div>

                    <div className="w-28">
                      <input
                        type="number"
                        min="1"
                        max={selectedStock?.availableQty}
                        value={line.quantity}
                        onChange={(e) =>
                          handleLineChange(idx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))
                        }
                        placeholder="Qty"
                        required
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 shadow-2xs focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>

                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="rounded-lg p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
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
              disabled={isLoading}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
            >
              {isLoading ? 'Reserving...' : 'Place Customer Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
