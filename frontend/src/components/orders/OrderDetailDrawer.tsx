import React, { useState } from 'react';
import { CustomerOrder } from '../../types';
import { DetailDrawer } from '../common/DetailDrawer';
import { StatusBadge } from '../common/StatusBadge';
import { RoleGuard } from '../common/RoleGuard';
import { ordersApi } from '../../api/orders.api';
import { getErrorMessage } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { ShoppingCart, Ban, User, AlertCircle } from 'lucide-react';

interface OrderDetailDrawerProps {
  order: CustomerOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OrderDetailDrawer: React.FC<OrderDetailDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, role } = useAuth();
  const toast = useToast();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!order) return null;

  const isOwner = user?.id === order.salesUserId;
  const canCancel = role === 'ADMIN' || (role === 'SALES' && isOwner);

  const handleCancel = async () => {
    setIsCancelling(true);
    setError(null);
    try {
      await ordersApi.cancel(order.id);
      toast.success('Order Cancelled', 'Reserved stock released and restored to available inventory.');
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  const totalReservedUnits = order.lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Customer Order ${order.id.slice(0, 8)}`}
      subtitle={`Customer: ${order.customerName}`}
    >
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</span>
            <div className="mt-1">
              <StatusBadge status={order.status} size="md" />
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reserved Units</span>
            <p className="text-base font-extrabold text-sky-600 dark:text-sky-400 mt-0.5">
              {totalReservedUnits} units
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Order Specifications */}
        <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex justify-between">
            <span className="text-slate-500">Sales Representative</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {order.salesUser?.name || order.salesUserId}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Created Date</span>
            <span className="font-mono text-slate-600 dark:text-slate-400">
              {new Date(order.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Reserved Lines Breakdown */}
        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Reserved Stock Lines</h4>
          <div className="space-y-2">
            {order.lines.map((line, idx) => (
              <div
                key={line.id || idx}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
              >
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-slate-100">{line.item?.name || 'Item'}</h5>
                  <p className="text-[11px] text-slate-500">
                    Loc: {line.location?.name || line.locationId} • SKU: {line.item?.sku}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                    {line.quantity} units
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cancellation Action */}
        {order.status === 'RESERVED' && (
          <div className="space-y-2.5 border-t border-slate-200 pt-5 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Order Management</h4>
            {canCancel ? (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex w-full items-center justify-center space-x-2 rounded-xl bg-rose-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-rose-500 disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                <span>{isCancelling ? 'Cancelling...' : 'Cancel Order (Release Reserved Stock)'}</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <User className="h-4 w-4 text-slate-400" />
                <span>Only the owning Sales representative or ADMIN can cancel this order.</span>
              </div>
            )}
          </div>
        )}
      </div>
    </DetailDrawer>
  );
};
