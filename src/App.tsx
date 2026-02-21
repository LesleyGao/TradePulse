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
  TrendingDown,
  Activity,
  FileText,
  Info,
  ChevronRight,
  ChevronDown,
  Trash2,
  Shield,
  Zap,
  LineChart as LineChartIcon,
  CalendarDays,
  DollarSign,
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
    slate: 'bg-stone-500/10 text-stone-600',
  };
  const iconBg = accent ? accentStyles[accent] : 'bg-stone-100 text-stone-600';
  const valueColor =
    trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-stone-900';
  return (
    <div
      className={cn(
        'p-5 sm:p-6 rounded-xl border transition-all duration-200 flex flex-col gap-4 min-w-0',
        highlight
          ? 'bg-stone-100 border-stone-300 shadow-sm'
          : 'bg-white border-stone-200/80 hover:border-stone-300 hover:shadow-sm'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-stone-500 text-xs font-medium uppercase tracking-wider truncate">
          {title}
        </span>
        <div className={cn('p-2.5 rounded-lg shrink-0', iconBg)}>
          <Icon className="w-4 h-4" strokeWidth={2.25} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={cn('text-2xl sm:text-3xl font-bold tracking-tight tabular-nums', valueColor)}>
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
  const [expandedTradeKey, setExpandedTradeKey] = useState<string | null>(null);
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
  const OPTION_MULTIPLIER = 100; // 1 contract = 100 shares
  /** Same symbol on the same day = 1 trade. Group by date+symbol. PnL = (contracts × sell price) − (contracts × buy price) × 100. */
  const groupedTrades = useMemo(() => {
    const key = (t: Trade) => `${format(t.date, 'yyyy-MM-dd')}_${t.symbol}`;
    const map = new Map<
      string,
      { date: Date; symbol: string; netQty: number; amount: number; pnl: number }
    >();
    for (const t of trades) {
      const k = key(t);
      const existing = map.get(k);
      const qty = t.type === 'BUY' ? t.quantity : -t.quantity;
      const signedAmount = t.type === 'BUY' ? t.quantity * t.price : -(t.quantity * t.price);
      // PnL = sell proceeds − buy cost (per contract × 100)
      const fillPnl = t.type === 'SELL'
        ? t.quantity * t.price * OPTION_MULTIPLIER
        : -(t.quantity * t.price * OPTION_MULTIPLIER);
      if (!existing) {
        map.set(k, { date: t.date, symbol: t.symbol, netQty: qty, amount: signedAmount, pnl: fillPnl });
      } else {
        existing.netQty += qty;
        existing.amount += signedAmount;
        existing.pnl += fillPnl;
      }
    }
    return [...map.values()]
      .map((g) => ({
        date: g.date,
        symbol: g.symbol,
        type: (g.netQty >= 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
        quantity: Math.abs(g.netQty),
        price: g.netQty !== 0 ? Math.abs(g.amount) / Math.abs(g.netQty) : 0,
        pnl: g.pnl,
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [trades]);
  const displayedTrades = showAllTrades
    ? groupedTrades
    : groupedTrades.slice(0, RECENT_TRADES_LIMIT);
  const hasMoreTrades = groupedTrades.length > RECENT_TRADES_LIMIT;

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
    // 5-day rolling sum of daily PnL (last 5 trading days)
    const last5 = pnlData.slice(-5);
    const rolling5DayPnl = last5.reduce((sum, d) => sum + d.pnl, 0);

    // Win rate, avg win, avg loss: based on grouped trades (same symbol same day = 1 trade), using computed PnL per trade
    const winningTrades = groupedTrades.filter((t) => t.pnl > 0);
    const losingTrades = groupedTrades.filter((t) => t.pnl < 0);
    const totalTrades = groupedTrades.length;
    const winRate =
      totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

    const avgWin =
      winningTrades.length > 0
        ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length
        : 0;
    const avgWinFormatted =
      winningTrades.length === 0
        ? '—'
        : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(avgWin);

    const avgLoss =
      losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length
        : 0;
    const avgLossFormatted =
      losingTrades.length === 0
        ? '—'
        : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(avgLoss);

    // Breakeven win rate: WR×avgWin + (1-WR)×avgLoss = 0 → WR = |avgLoss|/(avgWin+|avgLoss|)
    let breakevenWinRatePct: number | null = null;
    if (winningTrades.length > 0 && losingTrades.length > 0 && avgWin > 0) {
      const absLoss = Math.abs(avgLoss);
      breakevenWinRatePct = (absLoss / (avgWin + absLoss)) * 100;
    } else if (winningTrades.length === 0 && losingTrades.length > 0) {
      breakevenWinRatePct = 100;
    }
    const breakevenWinRateFormatted =
      breakevenWinRatePct != null ? `${breakevenWinRatePct.toFixed(1)}%` : null;
    const aboveBreakeven =
      breakevenWinRatePct != null ? winRate >= breakevenWinRatePct : null;

    return {
      totalPnl: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPnl),
      winRate: `${winRate.toFixed(1)}%`,
      winRateNum: winRate,
      tradeCount: totalTrades,
      trend: totalPnl >= 0 ? 'up' : 'down',
      rolling5DayPnl: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(rolling5DayPnl),
      rolling5Trend: rolling5DayPnl >= 0 ? 'up' : 'down',
      avgWin: avgWinFormatted,
      avgLoss: avgLossFormatted,
      breakevenWinRate: breakevenWinRateFormatted,
      aboveBreakeven,
    };
  }, [pnlData, groupedTrades]);

  const clearData = () => {
    setTrades([]);
  };

  return (
    <div className="min-h-screen bg-stone-50/80 text-stone-900 font-sans antialiased selection:bg-stone-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center gap-2.5" onClick={(e) => { e.preventDefault(); setPage('dashboard'); }}>
              <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-base font-bold tracking-tight text-stone-900">TradePulse</span>
            </a>
            <nav className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPage('dashboard')}
                className={cn(
                  'text-sm font-medium px-3.5 py-2 rounded-md transition-colors',
                  page === 'dashboard'
                    ? 'bg-stone-100 text-stone-900'
                    : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                )}
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setPage('calculator')}
                className={cn(
                  'text-sm font-medium px-3.5 py-2 rounded-md transition-colors',
                  page === 'calculator'
                    ? 'bg-stone-100 text-stone-900'
                    : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                )}
              >
                Calculator
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {page === 'dashboard' && trades.length > 0 && (
              <button
                type="button"
                onClick={clearData}
                className="text-xs font-medium text-stone-500 hover:text-rose-600 hover:bg-rose-50/80 px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {page === 'calculator' ? (
          <PositionSizeCalculator />
        ) : (
        <AnimatePresence mode="wait">
          {trades.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="max-w-lg mx-auto"
            >
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard</h2>
                <p className="text-stone-600 mt-1.5 text-sm">
                  Upload your Webull options CSV to see PnL, risk, and activity.
                </p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileUpload}
                className={cn(
                  'relative rounded-2xl border-2 border-dashed p-12 sm:p-14 flex flex-col items-center justify-center gap-6 transition-all min-h-[260px]',
                  isDragging
                    ? 'border-stone-500 bg-stone-100 scale-[1.01]'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50/50'
                )}
              >
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer rounded-2xl"
                />
                <div
                  className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center pointer-events-none transition-all',
                    isDragging ? 'bg-stone-800' : 'bg-stone-100'
                  )}
                >
                  <Upload className={cn('w-8 h-8', isDragging ? 'text-white' : 'text-stone-500')} strokeWidth={2} />
                </div>
                <div className="pointer-events-none text-center space-y-1">
                  <p className="font-semibold text-stone-900">Drop your CSV here or click to browse</p>
                  <p className="text-sm text-stone-500">Webull: Account → Orders → Export. CSV only.</p>
                </div>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 w-full max-w-sm bg-rose-50 text-rose-700 px-4 py-2.5 rounded-lg text-sm font-medium border border-rose-200"
                  >
                    {error}
                  </motion.div>
                )}
                <button
                  type="button"
                  onClick={loadSampleData}
                  className="relative z-10 text-sm font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 px-4 py-2 rounded-lg transition-colors"
                >
                  Load sample data instead
                </button>
              </div>

              <div className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-4 text-center">
                {[
                  { icon: Shield, label: 'Data stays in your browser' },
                  { icon: Zap, label: 'Auto-detects Webull columns' },
                  { icon: LineChartIcon, label: 'PnL chart + 20SMA' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-stone-500 text-sm">
                    <Icon className="w-4 h-4 text-stone-400" strokeWidth={2} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="space-y-10"
            >
              {/* Stats */}
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-4">Performance</h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Total PnL', value: stats?.totalPnl ?? '$0', icon: TrendingUp, trend: stats?.trend, accent: 'emerald' as const },
                    { title: '5-day rolling', value: stats?.rolling5DayPnl ?? '$0', icon: CalendarDays, trend: stats?.rolling5Trend, accent: 'slate' as const },
                    { title: 'Trades', value: stats?.tradeCount?.toString() ?? '0', icon: FileText, accent: 'amber' as const },
                    { title: 'Avg win', value: stats?.avgWin ?? '—', icon: DollarSign, trend: 'up' as const, accent: 'emerald' as const },
                    { title: 'Avg loss', value: stats?.avgLoss ?? '—', icon: TrendingDown, trend: 'down' as const, accent: 'rose' as const },
                    { title: 'Win rate', value: stats?.winRate ?? '0%', icon: Activity, accent: 'slate' as const },
                  ].map((item) => (
                    <StatCard
                      key={item.title}
                      title={item.title}
                      value={item.value}
                      icon={item.icon}
                      trend={item.trend as 'up' | 'down' | undefined}
                      accent={item.accent}
                      highlight={chartHovered}
                    />
                  ))}
                </div>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <div className="flex items-start gap-2.5 rounded-xl bg-stone-100/80 px-4 py-3 text-sm text-stone-600 flex-1">
                    <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                    <span>5-day rolling negative? Consider reducing size to limit drawdown.</span>
                  </div>
                  {stats?.breakevenWinRate != null && (
                    <div
                      className={cn(
                        'flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm flex-1',
                        stats.aboveBreakeven === true && 'bg-emerald-50 text-emerald-800',
                        stats.aboveBreakeven === false && 'bg-rose-50 text-rose-800',
                        stats.aboveBreakeven === null && 'bg-stone-100/80 text-stone-600'
                      )}
                    >
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Breakeven win rate: <strong>{stats.breakevenWinRate}</strong>
                        {stats.aboveBreakeven === true && ' — You’re above it.'}
                        {stats.aboveBreakeven === false && ' — Below it; cut losses or improve wins.'}
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Chart */}
              <section
                className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden"
                onMouseEnter={() => setChartHovered(true)}
                onMouseLeave={() => setChartHovered(false)}
              >
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-stone-900">PnL chart</h3>
                      <p className="text-sm text-stone-500 mt-0.5">Cumulative by day. Below SMA = consider reducing size. Hover to highlight stats.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-stone-500">20-day SMA</span>
                      <button
                        type="button"
                        onClick={() => setShowSma(!showSma)}
                        className={cn(
                          'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                          showSma ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        )}
                      >
                        {showSma ? 'On' : 'Off'}
                      </button>
                    </div>
                  </div>
                  {pnlData.length > 0 && (
                    <div className="flex items-center gap-4 text-xs text-stone-500">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-stone-800 rounded-full" />Cumulative</span>
                      {showSma && <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500" />20-day SMA</span>}
                    </div>
                  )}
                </div>
                <div className="h-[340px] sm:h-[380px] w-full border-t border-stone-100 bg-stone-50/50">
                  {pnlData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                      <LineChartIcon className="w-10 h-10 text-stone-300" strokeWidth={1.5} />
                      <p className="text-sm font-medium text-stone-500">No PnL data yet</p>
                      <p className="text-sm text-stone-400 max-w-xs">Upload a CSV or load sample data.</p>
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
                        tickFormatter={(value) => format(new Date(value + 'T12:00:00'), 'MMM d')}
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
                              <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100">
                                <div className="font-semibold text-stone-900 text-sm">
                                  {format(new Date(label + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                                </div>
                              </div>
                              <div className="px-4 py-3 space-y-2">
                                <div className="flex justify-between gap-6">
                                  <span className="text-stone-500 text-sm">Daily P/L</span>
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
                                <div className="flex justify-between gap-6 pt-1 border-t border-stone-100">
                                  <span className="text-stone-500 text-sm">Cumulative</span>
                                  <span className="font-semibold tabular-nums text-sm text-stone-900">
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
              </section>

              {/* Activity */}
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-4">Activity</h2>
                <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-stone-900">Recent trades</h3>
                      <p className="text-sm text-stone-500 mt-0.5">{groupedTrades.length} trade{groupedTrades.length !== 1 ? 's' : ''} · Newest first</p>
                    </div>
                    {hasMoreTrades && (
                      <button
                        type="button"
                        onClick={() => setShowAllTrades((prev) => !prev)}
                        className="text-sm font-medium text-stone-600 hover:text-stone-900 py-2 px-3 rounded-lg hover:bg-stone-100 transition-colors w-fit flex items-center gap-1.5"
                      >
                        {showAllTrades ? 'Show less' : 'View all'}
                        <ChevronRight className={cn('w-4 h-4', showAllTrades && 'rotate-90')} />
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-stone-50">
                          <th className="sticky left-0 z-10 bg-stone-50 px-4 sm:px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-100">Date</th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-100">Symbol</th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-100">Type</th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-100">Contracts</th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider border-b border-stone-100">Price</th>
                          <th className="px-4 sm:px-6 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wider text-right border-b border-stone-100">PnL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                      {displayedTrades.map((trade, i) => {
                        const dayKey = format(trade.date, 'yyyy-MM-dd');
                        const tradeKey = `${dayKey}_${trade.symbol}`;
                        const isExpanded = expandedTradeKey === tradeKey;
                        const underlyingFills = trades.filter(
                          (t) => format(t.date, 'yyyy-MM-dd') === dayKey && t.symbol === trade.symbol
                        );
                        return (
                          <React.Fragment key={`${dayKey}-${trade.symbol}-${i}`}>
                          <tr
                            className="hover:bg-stone-50/80 transition-colors"
                          >
                            <td className="sticky left-0 z-10 bg-inherit px-4 sm:px-6 py-3 text-sm text-stone-600 whitespace-nowrap">
                              {new Intl.DateTimeFormat('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }).format(trade.date)}
                            </td>
                            <td className="px-4 sm:px-6 py-3">
                              <button
                                type="button"
                                onClick={() => setExpandedTradeKey((k) => (k === tradeKey ? null : tradeKey))}
                                className={cn(
                                  'font-mono text-sm font-medium text-stone-900 inline-flex items-center gap-1.5 rounded px-1 -mx-1 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-1',
                                  isExpanded && 'bg-stone-100'
                                )}
                              >
                                {trade.symbol}
                                <ChevronDown
                                  className={cn('w-4 h-4 text-stone-400 shrink-0 transition-transform', isExpanded && 'rotate-180')}
                                />
                              </button>
                            </td>
                            <td className="px-4 sm:px-6 py-3">
                              <span
                                className={cn(
                                  'text-xs font-semibold px-2 py-0.5 rounded',
                                  trade.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                )}
                              >
                                {trade.type}
                              </span>
                            </td>
                            <td className="px-4 sm:px-6 py-3 text-sm text-stone-600">{trade.quantity}</td>
                            <td className="px-4 sm:px-6 py-3 text-sm text-stone-600 tabular-nums">${trade.price.toFixed(2)}</td>
                            <td className="px-4 sm:px-6 py-3 text-sm font-medium text-right tabular-nums">
                              {trade.pnl !== 0 ? (
                                <span className={trade.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-stone-400">$0.00</span>
                              )}
                            </td>
                          </tr>
                          {isExpanded && underlyingFills.length > 0 && (
                            <tr className="bg-stone-50/80">
                              <td colSpan={6} className="px-4 sm:px-6 py-3 align-top">
                                <div className="text-xs text-stone-500 mb-2">All fills</div>
                                <div className="border border-stone-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-stone-100">
                                        <th className="px-3 py-2 text-xs font-semibold text-stone-500 uppercase">Type</th>
                                        <th className="px-3 py-2 text-xs font-semibold text-stone-500 uppercase">Contracts</th>
                                        <th className="px-3 py-2 text-xs font-semibold text-stone-500 uppercase text-right">Price</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                      {underlyingFills.map((fill, j) => (
                                        <tr key={j} className="bg-white">
                                          <td className="px-3 py-2">
                                            <span
                                              className={cn(
                                                'text-xs font-semibold px-2 py-0.5 rounded',
                                                fill.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                              )}
                                            >
                                              {fill.type}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-stone-600">{fill.quantity}</td>
                                          <td className="px-3 py-2 text-right tabular-nums text-stone-600">${fill.price.toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </main>

      <footer className="mt-auto py-8 border-t border-stone-200 bg-white/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-stone-500">TradePulse · Webull options PnL. Data stays in your browser.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-stone-500 hover:text-stone-800 transition-colors">Privacy</a>
            <a href="#" className="text-sm text-stone-500 hover:text-stone-800 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
