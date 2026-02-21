/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Shield,
  ShieldCheck,
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
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [tradesPage, setTradesPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [chartHovered, setChartHovered] = useState(false);
  const [expandedTradeKey, setExpandedTradeKey] = useState<string | null>(null);
  const [maxLossesPerDay, setMaxLossesPerDay] = useState(2); // user's rule: stop after this many losses in a day
  const [error, setError] = useState<string | null>(null);

  /** Exclude "TSLA" and "TSLA CoveredStock" from recent trades and all derived data. */
  const isSymbolExcluded = useCallback((symbol: string) => /^TSLA(\s+CoveredStock)?$/i.test(symbol.trim()), []);
  const filteredTrades = useMemo(
    () => trades.filter((t) => !isSymbolExcluded(t.symbol)),
    [trades, isSymbolExcluded]
  );

  const pnlData = useMemo(() => calculatePnl(filteredTrades), [filteredTrades]);
  const pnlByDate = useMemo(() => {
    const map: Record<string, number> = {};
    pnlData.forEach((p) => {
      map[p.date] = p.pnl;
    });
    return map;
  }, [pnlData]);

  /** Chart data aggregated by selected period (daily, monthly, yearly). */
  const chartData = useMemo(() => {
    if (pnlData.length === 0) return [];
    if (chartPeriod === 'daily') return pnlData;

    const groupKey = (d: string) =>
      chartPeriod === 'monthly' ? d.slice(0, 7) : d.slice(0, 4); // yyyy-MM or yyyy
    const groups: Record<string, { pnl: number; dateLabel: string }> = {};
    for (const p of pnlData) {
      const key = groupKey(p.date);
      if (!groups[key]) {
        groups[key] = { pnl: 0, dateLabel: chartPeriod === 'monthly' ? `${key}-01` : `${key}-01-01` };
      }
      groups[key].pnl += p.pnl;
    }
    const sortedKeys = Object.keys(groups).sort();
    let cumulative = 0;
    return sortedKeys.map((key) => {
      cumulative += groups[key].pnl;
      return {
        date: groups[key].dateLabel,
        timestamp: new Date(groups[key].dateLabel + 'T12:00:00').getTime(),
        pnl: groups[key].pnl,
        cumulativePnl: cumulative,
      } as PnlPoint;
    });
  }, [pnlData, chartPeriod]);

  const TRADES_PAGE_SIZE = 20;
  const OPTION_MULTIPLIER = 100; // 1 contract = 100 shares
  /** Same symbol on the same day = 1 trade. Group by date+symbol. PnL = (contracts × sell price) − (contracts × buy price) × 100. */
  const groupedTrades = useMemo(() => {
    const key = (t: Trade) => `${format(t.date, 'yyyy-MM-dd')}_${t.symbol}`;
    const map = new Map<
      string,
      { date: Date; symbol: string; netQty: number; amount: number; pnl: number }
    >();
    for (const t of filteredTrades) {
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
  }, [filteredTrades]);

  const tradesTotalPages = Math.max(1, Math.ceil(groupedTrades.length / TRADES_PAGE_SIZE));
  const currentTradesPage = Math.min(tradesPage, tradesTotalPages);
  const displayedTrades = groupedTrades.slice(
    (currentTradesPage - 1) * TRADES_PAGE_SIZE,
    currentTradesPage * TRADES_PAGE_SIZE
  );

  useEffect(() => {
    setTradesPage(1);
  }, [groupedTrades.length]);
  useEffect(() => {
    if (tradesPage > tradesTotalPages && tradesTotalPages >= 1) setTradesPage(tradesTotalPages);
  }, [tradesPage, tradesTotalPages]);

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

    // Rule: max N losses per day (user-editable). Consistency = % of trading days with ≤N losing trades.
    const tradesByDay: Record<string, { losses: number }> = {};
    for (const t of groupedTrades) {
      const day = format(t.date, 'yyyy-MM-dd');
      if (!tradesByDay[day]) tradesByDay[day] = { losses: 0 };
      if (t.pnl < 0) tradesByDay[day].losses += 1;
    }
    const ruleTotalDays = Object.keys(tradesByDay).length;
    const ruleDaysBroke = Object.values(tradesByDay).filter((d) => d.losses > maxLossesPerDay).length;
    const ruleDaysFollowed = ruleTotalDays - ruleDaysBroke;
    const ruleConsistencyPct =
      ruleTotalDays > 0 ? (ruleDaysFollowed / ruleTotalDays) * 100 : null;
    const ruleConsistencyFormatted =
      ruleConsistencyPct != null ? `${ruleConsistencyPct.toFixed(1)}%` : '—';

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
      ruleConsistency: ruleConsistencyFormatted,
      ruleDaysFollowed,
      ruleTotalDays,
      ruleDaysBroke,
    };
  }, [pnlData, groupedTrades, maxLossesPerDay]);

  const clearData = () => {
    setTrades([]);
  };

  return (
    <div className="min-h-screen bg-stone-50/80 text-stone-900 font-sans antialiased selection:bg-stone-900 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <a
              href="#"
              className="flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2"
              onClick={(e) => { e.preventDefault(); setPage('dashboard'); }}
            >
              <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-base font-bold tracking-tight text-stone-900">TradePulse</span>
            </a>
            <nav className="flex items-center gap-1 p-0.5 rounded-lg bg-stone-100/80" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={page === 'dashboard'}
                onClick={() => setPage('dashboard')}
                className={cn(
                  'text-sm font-medium px-3.5 py-2 rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2',
                  page === 'dashboard'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
                )}
              >
                Dashboard
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={page === 'calculator'}
                onClick={() => setPage('calculator')}
                className={cn(
                  'text-sm font-medium px-3.5 py-2 rounded-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2',
                  page === 'calculator'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-800'
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
                className="text-xs font-medium text-stone-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-1"
                title="Clear all uploaded data"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear data
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
                <p className="text-stone-600 mt-1.5 text-sm max-w-sm mx-auto">
                  Upload your Webull options CSV to see PnL, win rate, and rule consistency.
                </p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileUpload}
                className={cn(
                  'relative rounded-2xl border-2 border-dashed p-12 sm:p-16 flex flex-col items-center justify-center gap-6 transition-all duration-200 min-h-[280px]',
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
                  aria-label="Upload Webull CSV"
                />
                <div
                  className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center pointer-events-none transition-colors',
                    isDragging ? 'bg-stone-800' : 'bg-stone-100'
                  )}
                >
                  <Upload className={cn('w-8 h-8', isDragging ? 'text-white' : 'text-stone-500')} strokeWidth={2} />
                </div>
                <div className="pointer-events-none text-center space-y-1.5">
                  <p className="font-semibold text-stone-900">Drop your CSV here or click to browse</p>
                  <p className="text-sm text-stone-500">Webull: Account → Orders → Export</p>
                </div>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 w-full max-w-sm bg-rose-50 text-rose-700 px-4 py-2.5 rounded-xl text-sm font-medium border border-rose-200"
                  >
                    {error}
                  </motion.div>
                )}
                <button
                  type="button"
                  onClick={loadSampleData}
                  className="relative z-10 text-sm font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 px-4 py-2.5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2"
                >
                  Load sample data instead
                </button>
              </div>

              <div className="mt-14 flex flex-wrap justify-center gap-x-10 gap-y-5 text-center">
                {[
                  { icon: Shield, label: 'Data stays in your browser' },
                  { icon: Zap, label: 'Auto-detects Webull columns' },
                  { icon: LineChartIcon, label: 'PnL chart + 20-day SMA' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5 text-stone-500 text-sm">
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
              className="space-y-12"
            >
              {/* Performance — redo */}
              <section className="space-y-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Performance</h2>

                {/* Hero: Total PnL + secondary */}
                <div
                  className={cn(
                    'rounded-2xl border p-6 sm:p-8 transition-all duration-200',
                    chartHovered ? 'bg-stone-100/80 border-stone-300' : 'bg-white border-stone-200/80'
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
                    <div>
                      <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Total PnL</p>
                      <p
                        className={cn(
                          'text-4xl sm:text-5xl font-bold tracking-tight tabular-nums mt-1',
                          stats?.trend === 'up' && 'text-emerald-600',
                          stats?.trend === 'down' && 'text-rose-600',
                          stats?.trend !== 'up' && stats?.trend !== 'down' && 'text-stone-900'
                        )}
                      >
                        {stats?.totalPnl ?? '$0'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 sm:gap-6">
                      <div>
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">5-day rolling</p>
                        <p className={cn('text-lg font-semibold tabular-nums', stats?.rolling5Trend === 'up' ? 'text-emerald-600' : stats?.rolling5Trend === 'down' ? 'text-rose-600' : 'text-stone-700')}>
                          {stats?.rolling5DayPnl ?? '$0'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-stone-400 uppercase tracking-wider">Trades</p>
                        <p className="text-lg font-semibold tabular-nums text-stone-700">{stats?.tradeCount ?? '0'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Per-trade metrics: 3 cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={cn('rounded-xl border p-5 transition-all', chartHovered ? 'bg-stone-50 border-stone-200' : 'bg-white border-stone-200/80')}>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Avg win</p>
                    <p className="text-2xl font-bold tabular-nums text-emerald-600 mt-1">{stats?.avgWin ?? '—'}</p>
                  </div>
                  <div className={cn('rounded-xl border p-5 transition-all', chartHovered ? 'bg-stone-50 border-stone-200' : 'bg-white border-stone-200/80')}>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Avg loss</p>
                    <p className="text-2xl font-bold tabular-nums text-rose-600 mt-1">{stats?.avgLoss ?? '—'}</p>
                  </div>
                  <div className={cn('rounded-xl border p-5 transition-all', chartHovered ? 'bg-stone-50 border-stone-200' : 'bg-white border-stone-200/80')}>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Win rate</p>
                    <p className="text-2xl font-bold tabular-nums text-stone-900 mt-1">{stats?.winRate ?? '0%'}</p>
                  </div>
                </div>

                {/* Rule + Insights in one row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Daily loss limit card — clear rule vs result */}
                  <div
                    className={cn(
                      'rounded-xl border overflow-hidden lg:col-span-2',
                      stats?.ruleDaysBroke === 0 ? 'bg-emerald-50/80 border-emerald-200/60' : 'bg-amber-50/80 border-amber-200/60'
                    )}
                  >
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
                      {/* Your rule */}
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn('p-2.5 rounded-xl shrink-0', stats?.ruleDaysBroke === 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10')}>
                          <ShieldCheck className={cn('w-5 h-5', stats?.ruleDaysBroke === 0 ? 'text-emerald-600' : 'text-amber-600')} strokeWidth={2.25} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">Daily loss limit</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-stone-600">Stop after</span>
                            <div className="inline-flex items-center rounded-lg border-2 border-stone-200 bg-white overflow-hidden focus-within:border-stone-400 focus-within:ring-2 focus-within:ring-stone-300 focus-within:ring-offset-1">
                              <button
                                type="button"
                                onClick={() => setMaxLossesPerDay((n) => (n > 1 ? n - 1 : 1))}
                                className="flex items-center justify-center w-9 h-9 text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                aria-label="Decrease max losses"
                              >
                                <span className="text-lg font-medium leading-none">−</span>
                              </button>
                              <label className="sr-only" htmlFor="max-losses-per-day">Max losses per day</label>
                              <input
                                id="max-losses-per-day"
                                type="number"
                                min={1}
                                max={20}
                                value={maxLossesPerDay}
                                onChange={(e) => {
                                  const n = parseInt(e.target.value, 10);
                                  if (!Number.isNaN(n) && n >= 1 && n <= 20) setMaxLossesPerDay(n);
                                }}
                                onBlur={(e) => {
                                  const n = parseInt(e.target.value, 10);
                                  if (Number.isNaN(n) || n < 1) setMaxLossesPerDay(1);
                                  else if (n > 20) setMaxLossesPerDay(20);
                                }}
                                className="w-12 h-9 text-center bg-transparent text-base font-bold text-stone-900 border-0 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                aria-label="Max losses per day"
                              />
                              <button
                                type="button"
                                onClick={() => setMaxLossesPerDay((n) => (n < 20 ? n + 1 : 20))}
                                className="flex items-center justify-center w-9 h-9 text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                                aria-label="Increase max losses"
                              >
                                <span className="text-lg font-medium leading-none">+</span>
                              </button>
                            </div>
                            <span className="text-sm text-stone-600">loss{maxLossesPerDay !== 1 ? 'es' : ''} per day</span>
                          </div>
                        </div>
                      </div>

                      {/* Result */}
                      <div className="flex items-center gap-4 sm:gap-6 sm:pl-6 sm:border-l sm:border-stone-200/70">
                        <div>
                          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-0.5">Consistency</p>
                          <p className={cn('text-2xl font-bold tabular-nums', stats?.ruleDaysBroke === 0 ? 'text-emerald-700' : 'text-amber-700')}>
                            {stats?.ruleConsistency ?? '—'}
                          </p>
                        </div>
                        {stats?.ruleTotalDays != null && stats.ruleTotalDays > 0 && (
                          <p className="text-sm text-stone-600">
                            <span className="font-semibold text-stone-800">{stats.ruleDaysFollowed}</span> of {stats.ruleTotalDays} days followed
                            {stats.ruleDaysBroke > 0 && (
                              <span className={cn('block mt-0.5 font-medium', stats.ruleDaysBroke === 0 ? 'text-stone-500' : 'text-amber-700')}>
                                {stats.ruleDaysBroke} day{stats.ruleDaysBroke !== 1 ? 's' : ''} over limit
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Insights panel */}
                  <div className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-5 space-y-3">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Insights</p>
                    <ul className="space-y-2.5 text-sm text-stone-600">
                      <li className="flex gap-2.5">
                        <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                        <span>5-day rolling negative? Consider reducing size to limit drawdown.</span>
                      </li>
                      {stats?.breakevenWinRate != null && (
                        <li
                          className={cn(
                            'flex gap-2.5',
                            stats.aboveBreakeven === true && 'text-emerald-700',
                            stats.aboveBreakeven === false && 'text-rose-700',
                            stats.aboveBreakeven === null && 'text-stone-600'
                          )}
                        >
                          <Info className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>
                            Breakeven win rate <strong>{stats.breakevenWinRate}</strong>
                            {stats.aboveBreakeven === true && ' — above it.'}
                            {stats.aboveBreakeven === false && ' — below it; cut losses or improve wins.'}
                          </span>
                        </li>
                      )}
                    </ul>
                  </div>
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
                      <p className="text-sm text-stone-500 mt-0.5">
                        {chartPeriod === 'daily' && 'Cumulative by day. Below SMA = consider reducing size. '}
                        Hover to highlight stats.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-stone-100">
                        {(['daily', 'monthly', 'yearly'] as const).map((period) => (
                          <button
                            key={period}
                            type="button"
                            onClick={() => setChartPeriod(period)}
                            className={cn(
                              'px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2',
                              chartPeriod === period ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'
                            )}
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                      {chartPeriod === 'daily' && (
                        <>
                          <span className="text-xs font-medium text-stone-500">20-day SMA</span>
                          <button
                            type="button"
                            onClick={() => setShowSma(!showSma)}
                            className={cn(
                              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2',
                              showSma ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            )}
                            aria-pressed={showSma}
                          >
                            {showSma ? 'On' : 'Off'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {chartData.length > 0 && (
                    <div className="flex items-center gap-4 text-xs text-stone-500">
                      <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-stone-800 rounded-full" />Cumulative</span>
                      {chartPeriod === 'daily' && showSma && <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500" />20-day SMA</span>}
                    </div>
                  )}
                </div>
                <div className="h-[340px] sm:h-[380px] w-full border-t border-stone-100 bg-stone-50/50">
                  {chartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                      <LineChartIcon className="w-10 h-10 text-stone-300" strokeWidth={1.5} />
                      <p className="text-sm font-medium text-stone-500">No PnL data yet</p>
                      <p className="text-sm text-stone-400 max-w-xs">Upload a CSV or load sample data.</p>
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      key={`pnl-chart-${chartPeriod}-${chartData.length}-${chartData[chartData.length - 1]?.date ?? ''}`}
                      data={chartData}
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
                        tickFormatter={(value) => format(new Date(value + 'T12:00:00'), chartPeriod === 'yearly' ? 'yyyy' : chartPeriod === 'monthly' ? 'MMM yyyy' : 'MMM d')}
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
                          const dateLabel = format(
                            new Date(label + 'T12:00:00'),
                            chartPeriod === 'yearly' ? 'yyyy' : chartPeriod === 'monthly' ? 'MMMM yyyy' : 'EEEE, MMM d, yyyy'
                          );
                          const periodLabel = chartPeriod === 'daily' ? 'Daily' : chartPeriod === 'monthly' ? 'Monthly' : 'Yearly';
                          return (
                            <div className="overflow-hidden">
                              <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-100">
                                <div className="font-semibold text-stone-900 text-sm">{dateLabel}</div>
                              </div>
                              <div className="px-4 py-3 space-y-2">
                                <div className="flex justify-between gap-6">
                                  <span className="text-stone-500 text-sm">{periodLabel} P/L</span>
                                  <span className={cn('font-semibold tabular-nums text-sm', point.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                    {point.pnl >= 0 ? '+' : ''}${point.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                {chartPeriod === 'daily' && point.rolling5DayPnl != null && (
                                  <div className="flex justify-between gap-6">
                                    <span className="text-stone-500 text-sm">5-day rolling</span>
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
                      {chartPeriod === 'daily' && showSma && (
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

              {/* Activity — Recent trades */}
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-4">Activity</h2>
                <div className="rounded-2xl border border-stone-200/80 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-stone-900">Recent trades</h3>
                    {tradesTotalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-stone-500 tabular-nums">
                          {(currentTradesPage - 1) * TRADES_PAGE_SIZE + 1}–{Math.min(currentTradesPage * TRADES_PAGE_SIZE, groupedTrades.length)} of {groupedTrades.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTradesPage((p) => Math.max(1, p - 1))}
                          disabled={currentTradesPage <= 1}
                          className="p-1.5 rounded text-stone-500 hover:bg-stone-100 disabled:opacity-40"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTradesPage((p) => Math.min(tradesTotalPages, p + 1))}
                          disabled={currentTradesPage >= tradesTotalPages}
                          className="p-1.5 rounded text-stone-500 hover:bg-stone-100 disabled:opacity-40"
                          aria-label="Next page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full" role="table">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50/80">
                          <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-stone-500 uppercase tracking-wider w-[7.5rem] sm:w-40">Date</th>
                          <th className="text-left py-3 px-4 sm:px-6 text-xs font-semibold text-stone-500 uppercase tracking-wider">Symbol</th>
                          <th className="text-right py-3 px-4 sm:px-6 text-xs font-semibold text-stone-500 uppercase tracking-wider w-28">PnL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTrades.map((trade, i) => {
                          const dayKey = format(trade.date, 'yyyy-MM-dd');
                          const tradeKey = `${dayKey}_${trade.symbol}`;
                          const isExpanded = expandedTradeKey === tradeKey;
                          const underlyingFills = filteredTrades.filter(
                            (t) => format(t.date, 'yyyy-MM-dd') === dayKey && t.symbol === trade.symbol
                          );
                          const hasFills = underlyingFills.length > 0;
                          return (
                            <React.Fragment key={`${dayKey}-${trade.symbol}-${i}`}>
                              <tr className={cn('border-b border-stone-100 hover:bg-stone-50/70 transition-colors', isExpanded && 'bg-stone-50/50')}>
                                <td className="py-3.5 px-4 sm:px-6 text-sm text-stone-600 tabular-nums whitespace-nowrap">
                                  {format(trade.date, 'MMM d, yyyy')}
                                </td>
                                <td className="py-3.5 px-4 sm:px-6">
                                  <button
                                    type="button"
                                    onClick={() => hasFills && setExpandedTradeKey((k) => (k === tradeKey ? null : tradeKey))}
                                    disabled={!hasFills}
                                    className={cn(
                                      'inline-flex items-center gap-1.5 text-left font-mono text-sm font-semibold text-stone-900',
                                      hasFills && 'hover:text-stone-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-1 rounded',
                                      !hasFills && 'cursor-default'
                                    )}
                                  >
                                    {trade.symbol}
                                    {hasFills && <ChevronDown className={cn('w-4 h-4 text-stone-400 shrink-0', isExpanded && 'rotate-180')} />}
                                  </button>
                                </td>
                                <td className="py-3.5 px-4 sm:px-6 text-right">
                                  <span
                                    className={cn(
                                      'text-sm font-semibold tabular-nums',
                                      trade.pnl > 0 && 'text-emerald-600',
                                      trade.pnl < 0 && 'text-rose-600',
                                      trade.pnl === 0 && 'text-stone-400'
                                    )}
                                  >
                                    {trade.pnl !== 0 ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                  </span>
                                </td>
                              </tr>
                              {isExpanded && hasFills && (
                                <tr className="bg-stone-50/50">
                                  <td colSpan={3} className="px-4 sm:px-6 py-4 align-top border-b border-stone-100">
                                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Fills ({underlyingFills.length})</p>
                                    <table className="w-full text-sm border-collapse">
                                      <thead>
                                        <tr className="text-stone-500">
                                          <th className="text-left py-2 pr-4 font-medium">Type</th>
                                          <th className="text-left py-2 pr-4 font-medium">Contracts</th>
                                          <th className="text-right py-2 font-medium">Price</th>
                                        </tr>
                                      </thead>
                                      <tbody className="text-stone-700">
                                        {underlyingFills.map((fill, j) => (
                                          <tr key={j} className="border-t border-stone-100">
                                            <td className="py-2 pr-4">
                                              <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-semibold', fill.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                                                {fill.type}
                                              </span>
                                            </td>
                                            <td className="py-2 pr-4 tabular-nums">{fill.quantity}</td>
                                            <td className="py-2 text-right tabular-nums">${fill.price.toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
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
