'use client';
import React from 'react';
import { cn } from '@/utils/cn';

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'emerald' | 'rose' | 'amber' | 'slate';
  highlight?: boolean;
}

export const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  accent,
  highlight,
}: StatCardProps) => {
  const accentStyles = {
    emerald: 'bg-emerald-500/10 text-emerald-600',
    rose: 'bg-rose-500/10 text-rose-600',
    amber: 'bg-amber-500/10 text-amber-600',
    slate: 'bg-stone-500/10 text-stone-600',
  };
  const iconBg = accent ? accentStyles[accent] : 'bg-stone-100 text-stone-600';
  const valueColor =
    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-stone-900';
  
  return (
    <div
      className={cn(
        'p-5 sm:p-6 rounded-2xl border transition-all duration-300 flex flex-col gap-4 min-w-0 group',
        highlight
          ? 'bg-stone-900 border-stone-800 text-white shadow-lg'
          : 'bg-white border-stone-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-stone-300 hover:shadow-md'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn(
          'text-xs font-medium uppercase tracking-wider truncate',
          highlight ? 'text-stone-400' : 'text-stone-500'
        )}>
          {title}
        </span>
        <div className={cn('p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-110 duration-300', iconBg)}>
          <Icon className="w-4 h-4" strokeWidth={2.25} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={cn(
          'text-xl sm:text-2xl font-bold tracking-tight tabular-nums', 
          highlight ? 'text-white' : valueColor
        )}>
          {value}
        </span>
        {trend && trend !== 'neutral' && (
          <span
            className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full transition-colors',
              trend === 'up' && (highlight ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'),
              trend === 'down' && (highlight ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700')
            )}
          >
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  );
};
