import React, { useState } from 'react';
import type { WorkOrder, WorkOrderStatus } from '../../types';
import { DetailDrawer } from '../common/DetailDrawer';
import { StatusBadge } from '../common/StatusBadge';
import { WorkOrderStockCheckCard } from './WorkOrderStockCheckCard';
import { workOrdersApi } from '../../api/workOrders.api';
import { getErrorMessage } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';
import { ArrowRight, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';

interface WorkOrderDetailModalProps {
  workOrder: WorkOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const WorkOrderDetailModal: React.FC<WorkOrderDetailModalProps> = ({
  workOrder,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user, role } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!workOrder) return null;

  const isAssignedUser = user?.id === workOrder.assignedUserId;
  const canUpdateStatus = role === 'ADMIN' || (role === 'OPERATIONS' && isAssignedUser);

  const handleTransition = async (nextStatus: WorkOrderStatus) => {
    setIsLoading(true);
    setError(null);
    try {
      await workOrdersApi.updateStatus(workOrder.id, nextStatus);
      toast.success('Status Updated', `Work Order transitioned to ${nextStatus.replace('_', ' ')}.`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DetailDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Work Order ${workOrder.id.slice(0, 8)}`}
      subtitle={`Created ${new Date(workOrder.createdAt).toLocaleDateString()}`}
    >
      <div className="space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current State</span>
            <div className="mt-1">
              <StatusBadge status={workOrder.status} size="md" />
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Operator</span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
              {workOrder.assignedUser?.name || workOrder.assignedUserId}
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center space-x-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Specifications */}
        <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex justify-between">
            <span className="text-slate-500">Target Item</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {workOrder.item?.name} ({workOrder.item?.sku})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Location</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {workOrder.location?.name || workOrder.locationId}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Required Quantity</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{workOrder.requiredQty} units</span>
          </div>
        </div>

        {/* Stock Readiness Shortage Card */}
        <WorkOrderStockCheckCard
          workOrderId={workOrder.id}
          initialStockCheck={workOrder.stockCheck}
          itemId={workOrder.itemId}
        />

        {/* State Machine Control Panel */}
        <div className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            State Machine Transition
          </h4>

          {workOrder.status === 'COMPLETED' ? (
            <div className="flex items-center space-x-2 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Work Order is fully COMPLETED. Terminal state reached.</span>
            </div>
          ) : canUpdateStatus ? (
            <div className="space-y-2">
              {workOrder.status === 'ASSIGNED' && (
                <button
                  onClick={() => handleTransition('IN_PROGRESS')}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center space-x-2 rounded-xl bg-amber-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-amber-500 disabled:opacity-50"
                >
                  <span>Start Execution (Transition ASSIGNED → IN_PROGRESS)</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {workOrder.status === 'IN_PROGRESS' && (
                <button
                  onClick={() => handleTransition('COMPLETED')}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center space-x-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 disabled:opacity-50"
                >
                  <span>Complete Work Order (Transition IN_PROGRESS → COMPLETED)</span>
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2 rounded-xl bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              <UserCheck className="h-4 w-4 text-slate-400" />
              <span>Only the assigned user or ADMIN can update this Work Order.</span>
            </div>
          )}
        </div>
      </div>
    </DetailDrawer>
  );
};
