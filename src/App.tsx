/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  ReferenceLine
} from 'recharts';
import {
  Upload,
  TrendingUp,
  Activity,
  FileText,
  Info,
  ChevronRight,
  Trash2,
  Shield,
  Zap,
  LineChart as LineChartIcon,
  CalendarDays,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { parseBrokerCsv, calculatePnl, type Trade, type PnlPoint } from './utils/pnlParser';
import { SAMPLE_CSV } from './constants';
import { format } from 'date-fns';
import PositionSizeCalculator from './pages/PositionSizeCalculator';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  accent,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'emerald' | 'rose' | 'amber' | 'slate';
}) => {
  const accentStyles = {
    emerald: 'bg-emerald-500/10 text-emerald-600',
    rose: 'bg-rose-500/10 text-rose-600',
    amber: 'bg-amber-500/10 text-amber-600',
    slate: 'bg-zinc-500/10 text-zinc-600',
  };
  const iconBg = accent ? accentStyles[accent] : 'bg-zinc-100 text-zinc-600';
  const valueColor =
    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-zinc-900';
  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/80 shadow-sm hover:shadow-md hover:border-zinc-300/80 transition-all duration-200 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
          {title}
        </span>
        <div className={cn('p-2.5 rounded-xl', iconBg)}>
          <Icon className="w-4 h-4" strokeWidth={2.25} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={cn('text-2xl sm:text-[1.6rem] font-bold tracking-tight tabular-nums', valueColor)}>
          {value}
        </span>
        {trend && trend !== 'neutral' && (
          <span
            className={cn(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              trend === 'up' && 'bg-emerald-100 text-emerald-700',
              trend === 'down' && 'bg-rose-100 text-rose-700'
            )}
          >
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  );
};

type Page = 'dashboard' | 'calculator';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showSma, setShowSma] = useState(true);
  const [showAllTrades, setShowAllTrades] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pnlData = useMemo(() => calculatePnl(trades), [trades]);
  const pnlByDate = useMemo(() => {
    const map: Record<string, number> = {};
    pnlData.forEach((p) => {
      map[p.date] = p.pnl;
    });
    return map;
  }, [pnlData]);

  const RECENT_TRADES_LIMIT = 20;
  const sortedByDate = useMemo(
    () => [...trades].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [trades]
  );
  const displayedTrades = showAllTrades
    ? sortedByDate
    : sortedByDate.slice(0, RECENT_TRADES_LIMIT);
  const hasMoreTrades = trades.length > RECENT_TRADES_LIMIT;

  const loadSampleData = () => {
    setError(null);
    const parsed = parseBrokerCsv(SAMPLE_CSV);
    setTrades(parsed);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);

    let file: File | null = null;
    if ('files' in e.target && e.target.files?.length) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer?.files?.length) {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseBrokerCsv(text);

      if (parsed.length === 0) {
        setError('No valid options orders found. Use your Webull options order list CSV (e.g. from Account → Orders → Export).');
        return;
      }

      setTrades(parsed);
    } catch (err) {
      setError('Could not read the file. Please upload a valid Webull options CSV.');
      console.error(err);
    }
  }, []);

  const stats = useMemo(() => {
    if (pnlData.length === 0) return null;
    const totalPnl = pnlData[pnlData.length - 1].cumulativePnl;
    const winningDays = pnlData.filter((d) => d.pnl > 0).length;
    const winRate =
      pnlData.length > 0 ? (winningDays / pnlData.length) * 100 : 0;
    // 5-day rolling sum of daily PnL (last 5 trading days)
    const last5 = pnlData.slice(-5);
    const rolling5DayPnl = last5.reduce((sum, d) => sum + d.pnl, 0);

    return {
      totalPnl: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPnl),
      winRate: `${winRate.toFixed(1)}%`,
      tradeCount: trades.length,
      trend: totalPnl >= 0 ? 'up' : 'down',
      rolling5DayPnl: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(rolling5DayPnl),
      rolling5Trend: rolling5DayPnl >= 0 ? 'up' : 'down',
    };
  }, [pnlData, trades]);

  const clearData = () => {
    setTrades([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100/60 text-zinc-900 font-sans selection:bg-zinc-900 selection:text-white">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" strokeWidth={2.25} />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                TradePulse
              </h1>
            </div>
            <nav className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPage('dashboard')}
                className={cn(
                  'text-sm font-medium px-4 py-2.5 rounded-lg transition-colors',
                  page === 'dashboard'
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
                )}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setPage('calculator')}
                className={cn(
                  'text-sm font-medium px-4 py-2.5 rounded-lg transition-colors',
                  page === 'calculator'
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
                )}
              >
                Calculator
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {page === 'dashboard' && trades.length > 0 && (
              <button
                type="button"
                onClick={clearData}
                className="text-sm font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear Data
              </button>
            )}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-zinc-500 hover:text-zinc-800 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              Docs
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {page === 'calculator' ? (
          <PositionSizeCalculator />
        ) : (
        <AnimatePresence mode="wait">
          {trades.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25 }}
              className="max-w-xl mx-auto mt-8 sm:mt-12"
            >
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileUpload}
                className={cn(
                  'relative border-2 border-dashed rounded-2xl p-10 sm:p-12 transition-all duration-200 flex flex-col items-center text-center gap-5',
                  isDragging
                    ? 'border-zinc-800 bg-zinc-100 scale-[1.01]'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/50 shadow-sm'
                )}
              >
                <div className="relative flex-1 flex flex-col items-center justify-center gap-6 min-h-[200px]">
                  <div className="absolute inset-0 cursor-pointer rounded-2xl">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div
                    className={cn(
                      'rounded-2xl flex items-center justify-center pointer-events-none transition-all duration-200',
                      isDragging ? 'bg-zinc-800 scale-105' : 'bg-zinc-100'
                    )}
                    style={{ width: '4.5rem', height: '4.5rem' }}
                  >
                    <Upload
                      className={cn('w-8 h-8', isDragging ? 'text-white' : 'text-zinc-500')}
                      strokeWidth={2}
                    />
                  </div>
                  <div className="space-y-2 pointer-events-none">
                    <h2 className="text-xl font-bold text-zinc-900">
                      Upload Webull options order list
                    </h2>
                    <p className="text-sm text-zinc-500 max-w-sm mx-auto leading-relaxed">
                      Drag and drop your CSV or click to browse. Export from Account → Orders → Export.
                    </p>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-20 bg-rose-50 text-rose-700 px-4 py-2.5 rounded-xl text-sm font-medium border border-rose-200/80 max-w-md"
                  >
                    {error}
                  </motion.div>
                )}
                <div className="relative z-20 flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <Info className="w-3.5 h-3.5" />
                    CSV only
                  </span>
                  <span className="hidden sm:inline text-zinc-200">·</span>
                  <button
                    type="button"
                    onClick={loadSampleData}
                    className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 px-2.5 py-1.5 rounded-lg transition-colors"
                  >
                    Load sample data
                  </button>
                </div>
              </div>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { icon: Shield, title: 'Privacy first', desc: 'Data stays in your browser. We never see your trades.', accent: 'bg-emerald-500/10 text-emerald-600' },
                  { icon: Zap, title: 'Smart parsing', desc: 'Detects Webull and other broker CSV columns automatically.', accent: 'bg-amber-500/10 text-amber-600' },
                  { icon: LineChartIcon, title: '20SMA overlay', desc: 'Toggle a 20-day moving average on your PnL chart.', accent: 'bg-zinc-500/10 text-zinc-600' },
                ].map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div
                      key={feature.title}
                      className="flex gap-4 p-5 rounded-2xl bg-white border border-zinc-200/80 shadow-sm hover:shadow-md hover:border-zinc-300/80 transition-all"
                    >
                      <div className={cn('shrink-0 w-11 h-11 rounded-xl flex items-center justify-center', feature.accent)}>
                        <Icon className="w-5 h-5" strokeWidth={2} />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <h3 className="font-semibold text-zinc-900 text-sm">
                          {feature.title}
                        </h3>
                        <p className="text-xs text-zinc-500 leading-relaxed">
                          {feature.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="space-y-6 sm:space-y-8"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                  title="Total PnL"
                  value={stats?.totalPnl ?? '$0.00'}
                  icon={TrendingUp}
                  trend={stats?.trend as 'up' | 'down' | undefined}
                  accent="emerald"
                />
                <StatCard
                  title="5-day rolling PnL"
                  value={stats?.rolling5DayPnl ?? '$0.00'}
                  icon={CalendarDays}
                  trend={stats?.rolling5Trend as 'up' | 'down' | undefined}
                  accent="slate"
                />
                <StatCard
                  title="Win rate"
                  value={stats?.winRate ?? '0%'}
                  icon={Activity}
                  accent="slate"
                />
                <StatCard
                  title="Trades"
                  value={stats?.tradeCount.toString() ?? '0'}
                  icon={FileText}
                  accent="amber"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-zinc-100/80 border border-zinc-200/60 px-3 py-2">
                <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                <p className="text-xs text-zinc-600">
                  Use 5-day rolling PnL to limit drawdown — consider reducing size when it&apos;s negative.
                </p>
              </div>

              {/* Chart Section */}
              <div className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200/80 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-zinc-900">PnL chart</h2>
                    <p className="text-sm text-zinc-500 mt-0.5">
                      Cumulative profit by day. Toggle 20-day SMA below.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
                    <span className="text-xs text-zinc-500 px-2.5 py-1.5">20SMA</span>
                    <button
                      type="button"
                      onClick={() => setShowSma(!showSma)}
                      className={cn(
                        'px-3.5 py-2 text-sm font-medium rounded-lg transition-all',
                        showSma
                          ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200/60'
                          : 'text-zinc-500 hover:text-zinc-700'
                      )}
                    >
                      {showSma ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>

                <div className="h-[340px] sm:h-[380px] w-full min-h-[280px] rounded-xl overflow-hidden bg-zinc-50/50 border border-zinc-100">
                  {pnlData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-400 text-sm font-medium rounded-xl bg-zinc-50/50 border border-zinc-100">
                      No PnL data yet. Upload a CSV or load sample data.
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      key={`pnl-chart-${pnlData.length}-${pnlData[pnlData.length - 1]?.date ?? ''}`}
                      data={pnlData}
                      margin={{ top: 12, right: 12, left: 8, bottom: 8 }}
                    >
                      <defs>
                        <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#18181b" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#18181b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#71717a' }}
                        dy={6}
                        tickFormatter={(value) => format(new Date(value), 'MMM d')}
                        padding={{ left: 4, right: 4 }}
                        interval="preserveStartEnd"
                        minTickGap={32}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={56}
                        tick={{ fontSize: 11, fill: '#71717a' }}
                        tickFormatter={(val) => `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toLocaleString()}`}
                        padding={{ top: 8, bottom: 8 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          borderRadius: '12px', 
                          border: '1px solid #f1f1f1',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        labelFormatter={(label) => format(new Date(label), 'MMM d, yyyy')}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length || !label) return null;
                          const point = payload[0]?.payload as PnlPoint;
                          return (
                            <div className="px-3 py-2 space-y-1">
                              <div className="font-medium text-zinc-900">
                                {format(new Date(label), 'MMM d, yyyy')}
                              </div>
                              <div className="text-sm text-zinc-600">
                                Daily P/L: <span className={cn('font-medium', point.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                  ${point.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {point.rolling5DayPnl != null && (
                                <div className="text-sm text-zinc-600">
                                  5-day rolling: <span className={cn('font-medium', point.rolling5DayPnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                    ${point.rolling5DayPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}
                              <div className="text-sm text-zinc-600">
                                Cumulative: <span className="font-medium text-zinc-900">
                                  ${point.cumulativePnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine y={0} stroke="#e4e4e7" strokeWidth={1} />
                      <Area 
                        type="monotone" 
                        dataKey="cumulativePnl" 
                        stroke="#18181b" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorPnl)" 
                        animationDuration={1500}
                      />
                      {showSma && (
                        <Line 
                          type="monotone" 
                          dataKey="sma20" 
                          stroke="#F27D26" 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={false}
                          animationDuration={1500}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Trade list */}
              <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900">Recent activity</h3>
                  {hasMoreTrades && (
                    <button
                      type="button"
                      onClick={() => setShowAllTrades((prev) => !prev)}
                      className="text-sm font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 py-2 px-3 rounded-lg hover:bg-zinc-100 transition-colors"
                    >
                      {showAllTrades ? 'Show less' : 'View all'}
                      <ChevronRight
                        className={cn('w-4 h-4 transition-transform', showAllTrades && 'rotate-90')}
                      />
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50">
                        <th className="sticky left-0 z-10 bg-zinc-50 px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Symbol
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Contracts
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">
                          Realized PnL (day)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {displayedTrades.map((trade, i) => {
                        const dayKey = format(trade.date, 'yyyy-MM-dd');
                        const prevDayKey =
                          i > 0 ? format(displayedTrades[i - 1].date, 'yyyy-MM-dd') : '';
                        const isFirstRowOfDay = dayKey !== prevDayKey;
                        const dayPnl = pnlByDate[dayKey] ?? 0;
                        return (
                          <tr
                            key={`${trade.date.getTime()}-${trade.symbol}-${trade.quantity}-${i}`}
                            className="hover:bg-zinc-50/80 transition-colors"
                          >
                            <td className="sticky left-0 z-10 bg-inherit px-4 sm:px-6 py-3.5 text-sm text-zinc-600 whitespace-nowrap">
                              {new Intl.DateTimeFormat('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }).format(trade.date)}
                            </td>
                            <td className="px-4 sm:px-6 py-3.5">
                              <span className="font-mono text-sm font-semibold text-zinc-900">
                                {trade.symbol}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-3.5">
                              <span
                                className={cn(
                                  'text-xs font-semibold px-2.5 py-1 rounded-lg',
                                  trade.type === 'BUY'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                )}
                              >
                                {trade.type}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-sm text-zinc-600">
                              {trade.quantity}
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-sm text-zinc-600 tabular-nums">
                              ${trade.price.toFixed(2)}
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-sm font-medium text-right tabular-nums">
                              {isFirstRowOfDay ? (
                                <span
                                  className={cn(
                                    dayPnl >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                  )}
                                >
                                  {dayPnl >= 0 ? '+' : ''}$
                                  {dayPnl.toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              ) : (
                                <span className="text-zinc-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-zinc-200 bg-white/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-500">
            TradePulse · Options PnL from your Webull CSV. Data stays in your browser.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors">
              Privacy
            </a>
            <a href="#" className="text-xs text-zinc-500 hover:text-zinc-800 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
