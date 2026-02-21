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
  highlight,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  accent?: 'emerald' | 'rose' | 'amber' | 'slate';
  highlight?: boolean;
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
    <div
      className={cn(
        'p-5 sm:p-6 rounded-2xl border shadow-sm transition-all duration-200 flex flex-col gap-4',
        highlight
          ? 'bg-zinc-100 border-zinc-300/80 shadow-md'
          : 'bg-white border-zinc-200/80 hover:shadow-md hover:border-zinc-300/80'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-zinc-600 text-xs font-medium uppercase tracking-wider">
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
  const [chartHovered, setChartHovered] = useState(false);
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="max-w-2xl mx-auto"
            >
              <div className="mb-10">
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard</h2>
                <p className="text-sm text-zinc-600 mt-2 leading-relaxed max-w-xl">
                  Upload your options order history to see PnL, rolling risk, and activity.
                </p>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileUpload}
                className={cn(
                  'relative border-2 border-dashed rounded-2xl p-10 sm:p-14 transition-all duration-200 flex flex-col items-center text-center gap-6',
                  isDragging
                    ? 'border-zinc-600 bg-zinc-100 scale-[1.02] shadow-lg shadow-zinc-200/50'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50/80 shadow-sm hover:shadow-md'
                )}
              >
                <div className="relative flex-1 flex flex-col items-center justify-center gap-6 min-h-[220px]">
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
                      isDragging ? 'bg-zinc-800 scale-110' : 'bg-zinc-100'
                    )}
                    style={{ width: '5rem', height: '5rem' }}
                  >
                    <Upload
                      className={cn('w-9 h-9', isDragging ? 'text-white' : 'text-zinc-500')}
                      strokeWidth={2}
                    />
                  </div>
                  <div className="space-y-2 pointer-events-none">
                    <h3 className="text-xl font-bold text-zinc-900">
                      Upload Webull options order list
                    </h3>
                    <p className="text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
                      Drag and drop your CSV or click to browse. Export from Account → Orders → Export.
                    </p>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-20 w-full max-w-md bg-rose-50 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium border border-rose-200"
                  >
                    {error}
                  </motion.div>
                )}
                <div className="relative z-20 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-2">
                  <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Info className="w-3.5 h-3.5" />
                    CSV only
                  </span>
                  <button
                    type="button"
                    onClick={loadSampleData}
                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 text-white text-sm font-semibold px-5 py-2.5 hover:bg-zinc-800 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 transition-all"
                  >
                    Load sample data
                  </button>
                </div>
              </div>

              <p className="text-xs text-zinc-500 text-center mt-8 mb-3 uppercase tracking-wider font-semibold">
                Why TradePulse
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                      <div className="space-y-1.5 min-w-0">
                        <h3 className="font-semibold text-zinc-900 text-sm">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-zinc-600 leading-relaxed">
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
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900">Overview</h2>
                <p className="text-sm text-zinc-600 mt-2 leading-relaxed max-w-xl">
                  Summary and chart from your uploaded trades.
                </p>
              </div>

              {/* Stats — single panel with cards and tip footer */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/40 shadow-sm p-4 sm:p-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <StatCard
                    title="Total PnL"
                    value={stats?.totalPnl ?? '$0.00'}
                    icon={TrendingUp}
                    trend={stats?.trend as 'up' | 'down' | undefined}
                    accent="emerald"
                    highlight={chartHovered}
                  />
                  <StatCard
                    title="5-day rolling PnL"
                    value={stats?.rolling5DayPnl ?? '$0.00'}
                    icon={CalendarDays}
                    trend={stats?.rolling5Trend as 'up' | 'down' | undefined}
                    accent="slate"
                    highlight={chartHovered}
                  />
                  <StatCard
                    title="Win rate"
                    value={stats?.winRate ?? '0%'}
                    icon={Activity}
                    accent="slate"
                    highlight={chartHovered}
                  />
                  <StatCard
                    title="Trades"
                    value={stats?.tradeCount.toString() ?? '0'}
                    icon={FileText}
                    accent="amber"
                    highlight={chartHovered}
                  />
                </div>
                <div className="mt-5 pt-4 border-t border-zinc-200/80 flex items-center gap-3 rounded-xl bg-zinc-50/80 px-4 py-3">
                  <Info className="w-4 h-4 text-zinc-500 shrink-0" />
                  <p className="text-sm text-zinc-600">
                    Use 5-day rolling PnL to limit drawdown — consider reducing size when it&apos;s negative.
                  </p>
                </div>
              </div>

              {/* Chart Section */}
              <div
                className="bg-white p-5 sm:p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-5 transition-shadow duration-200 hover:shadow-md"
                onMouseEnter={() => setChartHovered(true)}
                onMouseLeave={() => setChartHovered(false)}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-zinc-900">PnL chart</h3>
                    <p className="text-sm text-zinc-600 mt-1">
                      Cumulative PnL by day. Below the SMA = consider reducing size. Hover chart to highlight stats.
                    </p>
                  </div>
                  <div className="flex flex-col sm:items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl w-fit">
                      <span className="text-xs font-medium text-zinc-600 px-2.5 py-1.5">20-day SMA</span>
                      <button
                        type="button"
                        onClick={() => setShowSma(!showSma)}
                        className={cn(
                          'px-3.5 py-2 text-sm font-medium rounded-lg transition-all',
                          showSma
                            ? 'bg-white text-zinc-900 shadow-sm border border-zinc-200'
                            : 'text-zinc-500 hover:text-zinc-700'
                        )}
                      >
                        {showSma ? 'On' : 'Off'}
                      </button>
                    </div>
                    {pnlData.length > 0 && (
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-0.5 bg-zinc-900 rounded-full" aria-hidden />
                          Cumulative
                        </span>
                        {showSma && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500 rounded-full" aria-hidden />
                            20-day SMA
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="h-[360px] sm:h-[400px] w-full min-h-[300px] rounded-xl overflow-hidden bg-zinc-50/80 border border-zinc-200/80">
                  {pnlData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6 rounded-xl">
                      <div className="w-12 h-12 rounded-xl bg-zinc-200/80 flex items-center justify-center">
                        <LineChartIcon className="w-6 h-6 text-zinc-500" strokeWidth={1.5} />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-zinc-700">No PnL data yet</p>
                        <p className="text-sm text-zinc-500 max-w-sm leading-relaxed">
                          Upload a CSV or load sample data on the dashboard to see your cumulative PnL here.
                        </p>
                      </div>
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      key={`pnl-chart-${pnlData.length}-${pnlData[pnlData.length - 1]?.date ?? ''}`}
                      data={pnlData}
                      margin={{ top: 16, right: 16, left: 12, bottom: 12 }}
                    >
                      <defs>
                        <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#18181b" stopOpacity={0.12}/>
                          <stop offset="100%" stopColor="#18181b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#d4d4d8" strokeOpacity={0.8} />
                      <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#52525b', fontFamily: 'inherit' }}
                        dy={8}
                        tickFormatter={(value) => format(new Date(value), 'MMM d')}
                        padding={{ left: 8, right: 8 }}
                        interval="preserveStartEnd"
                        minTickGap={36}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        width={52}
                        tick={{ fontSize: 12, fill: '#52525b', fontFamily: 'inherit' }}
                        tickFormatter={(val) => {
                          if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
                          if (val >= 1000) return `$${(val / 1000).toFixed(1)}k`;
                          if (val <= -1000) return `-$${Math.abs(val / 1000).toFixed(1)}k`;
                          return `$${val.toLocaleString()}`;
                        }}
                        padding={{ top: 12, bottom: 12 }}
                      />
                      <Tooltip
                        cursor={{ stroke: '#a1a1aa', strokeWidth: 1, strokeDasharray: '4 4' }}
                        contentStyle={{
                          backgroundColor: '#fff',
                          borderRadius: '12px',
                          border: '1px solid #e4e4e7',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
                          padding: 0,
                        }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length || !label) return null;
                          const point = payload[0]?.payload as PnlPoint;
                          return (
                            <div className="overflow-hidden">
                              <div className="px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                                <div className="font-semibold text-zinc-900 text-sm">
                                  {format(new Date(label), 'EEEE, MMM d, yyyy')}
                                </div>
                              </div>
                              <div className="px-4 py-3 space-y-2">
                                <div className="flex justify-between gap-6">
                                  <span className="text-zinc-500 text-sm">Daily P/L</span>
                                  <span className={cn('font-semibold tabular-nums text-sm', point.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                    {point.pnl >= 0 ? '+' : ''}${point.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                {point.rolling5DayPnl != null && (
                                  <div className="flex justify-between gap-6">
                                    <span className="text-zinc-500 text-sm">5-day rolling</span>
                                    <span className={cn('font-semibold tabular-nums text-sm', point.rolling5DayPnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                      {point.rolling5DayPnl >= 0 ? '+' : ''}${point.rolling5DayPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-6 pt-1 border-t border-zinc-100">
                                  <span className="text-zinc-500 text-sm">Cumulative</span>
                                  <span className="font-semibold tabular-nums text-sm text-zinc-900">
                                    {point.cumulativePnl >= 0 ? '+' : ''}${point.cumulativePnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine y={0} stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="2 2" />
                      <Area
                        type="monotone"
                        dataKey="cumulativePnl"
                        stroke="#18181b"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorPnl)"
                        animationDuration={1200}
                        animationEasing="ease-out"
                      />
                      {showSma && (
                        <Line
                          type="monotone"
                          dataKey="sma20"
                          stroke="#d97706"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                          dot={false}
                          animationDuration={1200}
                          animationEasing="ease-out"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Trade list */}
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-50/30">
                  <div>
                    <h3 className="font-semibold text-zinc-900">Recent activity</h3>
                    <p className="text-sm text-zinc-600 mt-0.5">
                      {trades.length} trade{trades.length !== 1 ? 's' : ''} · Newest first
                    </p>
                  </div>
                  {hasMoreTrades && (
                    <button
                      type="button"
                      onClick={() => setShowAllTrades((prev) => !prev)}
                      className="text-sm font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5 py-2 px-3 rounded-lg hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 transition-colors w-fit"
                    >
                      {showAllTrades ? 'Show less' : 'View all'}
                      <ChevronRight
                        className={cn('w-4 h-4 transition-transform', showAllTrades && 'rotate-90')}
                      />
                    </button>
                  )}
                </div>
                <div className="overflow-x-auto -mb-px">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/90">
                        <th className="sticky left-0 z-10 bg-zinc-50/90 px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-600 uppercase tracking-wider border-b border-zinc-100">
                          Date
                        </th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-600 uppercase tracking-wider border-b border-zinc-100">Symbol</th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-600 uppercase tracking-wider border-b border-zinc-100">Type</th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-600 uppercase tracking-wider border-b border-zinc-100">Contracts</th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-600 uppercase tracking-wider border-b border-zinc-100">Price</th>
                        <th className="px-4 sm:px-6 py-3.5 text-xs font-semibold text-zinc-600 uppercase tracking-wider text-right border-b border-zinc-100">Realized PnL (day)</th>
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
                            <td className="sticky left-0 z-10 bg-inherit px-4 sm:px-6 py-3.5 text-sm text-zinc-700 whitespace-nowrap">
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
                            <td className="px-4 sm:px-6 py-3.5 text-sm text-zinc-700">
                              {trade.quantity}
                            </td>
                            <td className="px-4 sm:px-6 py-3.5 text-sm text-zinc-700 tabular-nums">
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
          <p className="text-sm text-zinc-600 leading-relaxed">
            TradePulse · Options PnL from your Webull CSV. Data stays in your browser.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              Privacy
            </a>
            <a href="#" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
