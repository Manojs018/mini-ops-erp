import React from 'react';

interface QuantityBadgeProps {
  value: number;
  type?: 'available' | 'physical' | 'reserved' | 'shortage';
  size?: 'sm' | 'md' | 'lg';
}

export const QuantityBadge: React.FC<QuantityBadgeProps> = ({
  value,
  type = 'available',
  size = 'md',
}) => {
  const getStyles = () => {
    switch (type) {
      case 'available':
        if (value === 0) {
          return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
        }
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
      case 'reserved':
        return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800';
      case 'physical':
        return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700';
      case 'shortage':
        if (value > 0) {
          return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 font-bold';
        }
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-bold',
  }[size];

  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg border font-mono tracking-tight shadow-2xs ${getStyles()} ${sizeClasses}`}
    >
      {value.toLocaleString()}
    </span>
  );
};
