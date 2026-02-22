/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback, useEffect, useRef, startTransition } from 'react';
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
        'p-5 sm:p-6 rounded-2xl border transition-all duration-200 flex flex-col gap-4 min-w-0',
        highlight
          ? 'bg-stone-100 border-stone-300 shadow-sm'
          : 'bg-white border-stone-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:border-stone-300 hover:shadow-sm'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-stone-500 text-xs font-medium uppercase tracking-wider truncate">
          {title}
        </span>
        <div className={cn('p-2.5 rounded-xl shrink-0', iconBg)}>
          <Icon className="w-4 h-4" strokeWidth={2.25} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className={cn('text-xl sm:text-2xl font-bold tracking-tight tabular-nums', valueColor)}>
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

const SAVED_CSV_KEY = 'tradepulse_csv';

/** OCC-style options symbol: root (1–6 letters) + YYMMDD + C|P + 8-digit strike (e.g. IWM260220C00266000). */
function isOccOptionSymbol(symbol: string): boolean {
  return /^[A-Z]{1,6}\d{6}[CP]\d{8}$/i.test(symbol.trim());
}

export interface OccParsed {
  underlying: string;
  expiration: string; // yyyy-MM-dd
  optionType: 'Call' | 'Put';
  strike: number;
}

/** Parse OCC option symbol into underlying, expiration (YYYY-MM-DD), type (Call/Put), and strike. */
function parseOccSymbol(symbol: string): OccParsed | null {
  const m = symbol.trim().match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/i);
  if (!m) return null;
  const [, root, yymmdd, cp, strikeStr] = m;
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = parseInt(yymmdd.slice(2, 4), 10);
  const dd = parseInt(yymmdd.slice(4, 6), 10);
  const year = 2000 + yy;
  const expiration = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const strike = parseInt(strikeStr, 10) / 1000;
  return {
    underlying: root!.toUpperCase(),
    expiration,
    optionType: cp!.toUpperCase() === 'C' ? 'Call' : 'Put',
    strike,
  };
}

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [hasRestoredSaved, setHasRestoredSaved] = useState(false);
  const [showSma, setShowSma] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [tradesPage, setTradesPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [chartHovered, setChartHovered] = useState(false);
  const [expandedTradeKey, setExpandedTradeKey] = useState<string | null>(null);
  const [maxLossesPerDay, setMaxLossesPerDay] = useState(2); // user's rule: stop after this many losses in a day
  const [monthSort, setMonthSort] = useState<'best' | 'worst' | 'date'>('best');
  const [calendarMonthSort, setCalendarMonthSort] = useState<'best' | 'worst' | 'date'>('worst');
  const [statsPeriod, setStatsPeriod] = useState<'total' | number>(() => new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** OCC-style option symbols only: used for PnL chart, total PnL, all stats, and Recent trades. */
  const tradesForActivity = useMemo(
    () => trades.filter((t) => isOccOptionSymbol(t.symbol)),
    [trades]
  );

  const pnlData = useMemo(() => calculatePnl(tradesForActivity), [tradesForActivity]);

  /** Years that have data (for stats period selector). */
  const yearsWithData = useMemo(
    () => [...new Set(pnlData.map((p) => p.date.slice(0, 4)))].map(Number).sort((a, b) => b - a),
    [pnlData]
  );

  const pnlByDate = useMemo(() => {
    const map: Record<string, number> = {};
    pnlData.forEach((p) => {
      map[p.date] = p.pnl;
    });
    return map;
  }, [pnlData]);

  /** Chart data: follows View stats period (Total or selected year), aggregated by daily/monthly/yearly. */
  const chartData = useMemo(() => {
    const source =
      statsPeriod === 'total'
        ? pnlData
        : pnlData.filter((p) => p.date.startsWith(String(statsPeriod)));
    if (source.length === 0) return [];
    if (chartPeriod === 'daily') return source;

    const groupKey = (d: string) =>
      chartPeriod === 'monthly' ? d.slice(0, 7) : d.slice(0, 4); // yyyy-MM or yyyy
    const groups: Record<string, { pnl: number; dateLabel: string }> = {};
    for (const p of source) {
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
  }, [pnlData, chartPeriod, statsPeriod]);

  const TRADES_PAGE_SIZE = 15;
  const OPTION_MULTIPLIER = 100; // 1 contract = 100 shares
  /** OCC-only: same symbol same day = 1 trade. Group by date+symbol. Used for Recent trades, stats, and PnL. */
  const groupedTradesForActivity = useMemo(() => {
    const key = (t: Trade) => `${format(t.date, 'yyyy-MM-dd')}_${t.symbol}`;
    const map = new Map<
      string,
      { date: Date; symbol: string; netQty: number; amount: number; pnl: number }
    >();
    for (const t of tradesForActivity) {
      const k = key(t);
      const existing = map.get(k);
      const qty = t.type === 'BUY' ? t.quantity : -t.quantity;
      const signedAmount = t.type === 'BUY' ? t.quantity * t.price : -(t.quantity * t.price);
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
  }, [tradesForActivity]);


  /** Restore saved CSV from localStorage on mount (once). */
  useEffect(() => {
    if (hasRestoredSaved) return;
    setHasRestoredSaved(true);
    try {
      const saved = localStorage.getItem(SAVED_CSV_KEY);
      if (saved) {
        const parsed = parseBrokerCsv(saved);
        if (parsed.length > 0) setTrades(parsed);
      }
    } catch {
      // ignore invalid or missing saved data
    }
  }, [hasRestoredSaved]);

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
      try {
        localStorage.setItem(SAVED_CSV_KEY, text);
      } catch {
        // ignore quota or other storage errors
      }
      if ('files' in e.target && e.target instanceof HTMLInputElement) {
        e.target.value = '';
      }
    } catch (err) {
      setError('Could not read the file. Please upload a valid Webull options CSV.');
      console.error(err);
    }
  }, []);

  const pnlDataForStats = useMemo(
    () =>
      statsPeriod === 'total'
        ? pnlData
        : pnlData.filter((p) => p.date.startsWith(String(statsPeriod))),
    [pnlData, statsPeriod]
  );
  const groupedTradesForStats = useMemo(
    () =>
      statsPeriod === 'total'
        ? groupedTradesForActivity
        : groupedTradesForActivity.filter(
            (t) => format(t.date, 'yyyy') === String(statsPeriod)
          ),
    [groupedTradesForActivity, statsPeriod]
  );

  /** Filtered trades for Recent trades fills (same period as View stats). */
  const tradesForStats = useMemo(
    () =>
      statsPeriod === 'total'
        ? tradesForActivity
        : tradesForActivity.filter(
            (t) => format(t.date, 'yyyy') === String(statsPeriod)
          ),
    [tradesForActivity, statsPeriod]
  );

  const tradesTotalPages = Math.max(1, Math.ceil(groupedTradesForStats.length / TRADES_PAGE_SIZE));
  const currentTradesPage = Math.min(tradesPage, tradesTotalPages);
  const displayedTrades = groupedTradesForStats.slice(
    (currentTradesPage - 1) * TRADES_PAGE_SIZE,
    currentTradesPage * TRADES_PAGE_SIZE
  );

  useEffect(() => {
    setTradesPage(1);
  }, [groupedTradesForStats.length]);
  useEffect(() => {
    if (tradesPage > tradesTotalPages && tradesTotalPages >= 1) setTradesPage(tradesTotalPages);
  }, [tradesPage, tradesTotalPages]);

  const stats = useMemo(() => {
    if (pnlData.length === 0) return null;
    const totalPnl =
      pnlDataForStats.length > 0
        ? pnlDataForStats.reduce((s, p) => s + p.pnl, 0)
        : 0;
    const last5 = pnlDataForStats.slice(-5);
    const rolling5DayPnl = last5.reduce((sum, d) => sum + d.pnl, 0);

    const winningTrades = groupedTradesForStats.filter((t) => t.pnl > 0);
    const losingTrades = groupedTradesForStats.filter((t) => t.pnl < 0);
    const totalTrades = groupedTradesForStats.length;
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

    // Strategy Expectancy (Edge): expected $ per trade = (Win% × Avg Win) + (Loss% × Avg Loss)
    const winPct = totalTrades > 0 ? winningTrades.length / totalTrades : 0;
    const lossPct = totalTrades > 0 ? losingTrades.length / totalTrades : 0;
    const expectancy =
      totalTrades > 0 ? winPct * avgWin + lossPct * avgLoss : null;
    const expectancyFormatted =
      expectancy != null
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(expectancy)
        : '—';

    // Expectancy metric: expected $ per $1 risked = expectancy / |avgLoss| (only when there are losses)
    const absAvgLoss = losingTrades.length > 0 ? Math.abs(avgLoss) : 0;
    // Avg % win and avg % loss per trade: use return % (PnL / cost from fills), then average.
    // Build fills lookup once (O(M)) instead of filtering per trade (O(N*M)).
    const fillsByDaySymbol = new Map<string, typeof tradesForStats>();
    for (const f of tradesForStats) {
      const key = `${format(f.date, 'yyyy-MM-dd')}_${f.symbol}`;
      const arr = fillsByDaySymbol.get(key) ?? [];
      if (arr.length === 0) fillsByDaySymbol.set(key, arr);
      arr.push(f);
    }
    const returnPctFromFills = (grouped: { date: Date; symbol: string; type: 'BUY' | 'SELL'; quantity: number; price: number; pnl: number }) => {
      const dayKey = format(grouped.date, 'yyyy-MM-dd');
      const fills = fillsByDaySymbol.get(`${dayKey}_${grouped.symbol}`) ?? [];
      const costFromFills = fills.length > 0
        ? fills.filter((f) => f.type === grouped.type).reduce((sum, f) => sum + f.quantity * f.price * OPTION_MULTIPLIER, 0)
        : 0;
      const cost = costFromFills > 0 ? costFromFills : grouped.quantity * grouped.price * OPTION_MULTIPLIER;
      return cost > 0 ? (grouped.pnl / cost) * 100 : null;
    };
    const winningPcts = winningTrades.map(returnPctFromFills).filter((p): p is number => p != null);
    const losingPcts = losingTrades.map(returnPctFromFills).filter((p): p is number => p != null);
    const avgWinPct = winningPcts.length > 0 ? winningPcts.reduce((a, b) => a + b, 0) / winningPcts.length : null;
    const avgLossPct = losingPcts.length > 0 ? losingPcts.reduce((a, b) => a + b, 0) / losingPcts.length : null;
    const avgWinPctFormatted = avgWinPct != null ? `+${avgWinPct.toFixed(1)}%` : '—';
    const avgLossPctFormatted = avgLossPct != null ? `${avgLossPct.toFixed(1)}%` : '—';
    const expectancyMetric =
      expectancy != null && absAvgLoss > 0 ? expectancy / absAvgLoss : null;
    const expectancyMetricFormatted =
      expectancyMetric != null
        ? expectancyMetric.toFixed(2)
        : '—';

    // System Quality Number (Van Tharp): (Mean R-multiple / StdDev R-multiple) * sqrt(N). R = |avgLoss|.
    let sqn: number | null = null;
    if (totalTrades >= 2 && absAvgLoss > 0 && expectancy != null) {
      const R = absAvgLoss;
      const rMultiples = groupedTradesForStats.map((t) => t.pnl / R);
      const meanR = rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length;
      const variance = rMultiples.reduce((sum, x) => sum + (x - meanR) ** 2, 0) / (rMultiples.length - 1);
      const stdDevR = Math.sqrt(variance);
      if (stdDevR > 0) {
        sqn = (meanR / stdDevR) * Math.sqrt(totalTrades);
      }
    }
    const sqnFormatted = sqn != null ? sqn.toFixed(2) : '—';

    // Consecutive losses vs. probability: P(N losses in a row) = lossRate^N. Also max observed and current streak.
    const lossRate = lossPct;
    const sortedByDate = [...groupedTradesForStats].sort((a, b) => a.date.getTime() - b.date.getTime());
    let maxConsecutiveLossesObserved = 0;
    let current = 0;
    for (const t of sortedByDate) {
      if (t.pnl < 0) current += 1;
      else current = 0;
      maxConsecutiveLossesObserved = Math.max(maxConsecutiveLossesObserved, current);
    }
    // Current loss streak: consecutive losses at the end of the period
    let currentLossStreak = 0;
    for (let i = sortedByDate.length - 1; i >= 0 && sortedByDate[i]!.pnl < 0; i--) {
      currentLossStreak += 1;
    }
    const consecutiveLossProbs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((streak) => {
      const prob = totalTrades > 0 ? lossRate ** streak : 0;
      return { streak, probPct: prob * 100, probFormatted: `${(prob * 100).toFixed(1)}%` };
    });

    // Rule: max N losses per day (user-editable). Consistency = % of trading days with ≤N losing trades.
    const tradesByDay: Record<string, { losses: number }> = {};
    for (const t of groupedTradesForStats) {
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

    // PnL by month: include all months in period (Jan–Dec) even if no data yet. Add % return for sort/filter.
    const byMonth: Record<string, number> = {};
    for (const p of pnlData) {
      const monthKey = p.date.slice(0, 7); // yyyy-MM
      byMonth[monthKey] = (byMonth[monthKey] ?? 0) + p.pnl;
    }
    const costForGrouped = (grouped: { date: Date; symbol: string; type: 'BUY' | 'SELL'; quantity: number; price: number }) => {
      const dayKey = format(grouped.date, 'yyyy-MM-dd');
      const fills = fillsByDaySymbol.get(`${dayKey}_${grouped.symbol}`) ?? [];
      const costFromFills = fills.length > 0
        ? fills.filter((f) => f.type === grouped.type).reduce((sum, f) => sum + f.quantity * f.price * OPTION_MULTIPLIER, 0)
        : 0;
      return costFromFills > 0 ? costFromFills : grouped.quantity * grouped.price * OPTION_MULTIPLIER;
    };
    const byMonthCost: Record<string, number> = {};
    for (const t of groupedTradesForStats) {
      const monthKey = format(t.date, 'yyyy-MM');
      byMonthCost[monthKey] = (byMonthCost[monthKey] ?? 0) + costForGrouped(t);
    }
    const formatMonthLabel = (yyyyMm: string) => {
      const [y, m] = yyyyMm.split('-');
      const d = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, 1);
      return format(d, 'MMM yyyy');
    };
    const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const yearsInData = [...new Set(pnlData.map((p) => p.date.slice(0, 4)))].map(Number).sort((a, b) => a - b);
    const yearsToShow = statsPeriod === 'total' ? yearsInData : [statsPeriod as number];
    const monthsList: { monthKey: string; label: string; pnl: number; pnlFormatted: string; pct: number | null; pctFormatted: string }[] = [];
    for (const year of yearsToShow) {
      for (let month = 1; month <= 12; month++) {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        const pnl = byMonth[monthKey] ?? 0;
        const cost = byMonthCost[monthKey] ?? 0;
        const pct = cost > 0 ? (pnl / cost) * 100 : null;
        monthsList.push({
          monthKey,
          label: formatMonthLabel(monthKey),
          pnl,
          pnlFormatted: currencyFmt.format(pnl),
          pct,
          pctFormatted: pct != null ? (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%' : '—',
        });
      }
    }

    // By calendar month (Jan–Dec): avg % return across full years only → which month performs best/worst on avg
    const currentYear = new Date().getFullYear();
    const fullYearsMonths = monthsList.filter((m) => parseInt(m.monthKey.slice(0, 4), 10) < currentYear);
    const byCalendarMonthPcts = new Map<number, number[]>();
    for (const m of fullYearsMonths) {
      if (m.pct == null) continue;
      const monthNum = parseInt(m.monthKey.slice(5, 7), 10);
      const arr = byCalendarMonthPcts.get(monthNum) ?? [];
      if (arr.length === 0) byCalendarMonthPcts.set(monthNum, arr);
      arr.push(m.pct);
    }
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const calendarMonthAvgList: { monthNum: number; name: string; avgPct: number | null; pctFormatted: string }[] = [];
    for (let monthNum = 1; monthNum <= 12; monthNum++) {
      const pcts = byCalendarMonthPcts.get(monthNum) ?? [];
      const avgPct = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
      const name = monthNames[monthNum - 1] ?? '';
      calendarMonthAvgList.push({
        monthNum,
        name,
        avgPct,
        pctFormatted: avgPct != null ? (avgPct >= 0 ? '+' : '') + avgPct.toFixed(1) + '%' : '—',
      });
    }

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
      avgWinPctFormatted,
      avgLossPctFormatted,
      breakevenWinRate: breakevenWinRateFormatted,
      aboveBreakeven,
      expectancyFormatted,
      expectancy,
      expectancyMetricFormatted,
      expectancyMetric,
      sqnFormatted,
      sqn,
      consecutiveLossProbs,
      maxConsecutiveLossesObserved,
      currentLossStreak,
      ruleConsistency: ruleConsistencyFormatted,
      ruleDaysFollowed,
      ruleTotalDays,
      ruleDaysBroke,
      monthsList,
      calendarMonthAvgList,
    };
  }, [pnlData, pnlDataForStats, groupedTradesForStats, tradesForStats, statsPeriod, maxLossesPerDay]);

  useEffect(() => {
    if (statsPeriod === 'total') return; /* user chose All time — don't override */
    if (yearsWithData.length === 0) return;
    const currentYear = new Date().getFullYear();
    if (!yearsWithData.includes(statsPeriod)) {
      if (yearsWithData.includes(currentYear)) setStatsPeriod(currentYear);
      else setStatsPeriod(yearsWithData[0]!);
    }
  }, [statsPeriod, yearsWithData]);

  const clearData = () => {
    try {
      localStorage.removeItem(SAVED_CSV_KEY);
    } catch {
      // ignore
    }
    setTrades([]);
  };

  return (
    <div className="min-h-screen text-stone-900 font-sans antialiased selection:bg-stone-900 selection:text-white" style={{ backgroundColor: '#fafaf9' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 sm:h-16 flex items-center justify-between">
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
            <nav className="flex items-center gap-1 p-1.5 rounded-xl bg-stone-100" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={page === 'dashboard'}
                onClick={() => setPage('dashboard')}
                className={cn(
                  'text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2',
                  page === 'dashboard'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
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
                  'text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2',
                  page === 'calculator'
                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                    : 'text-stone-500 hover:text-stone-800'
                )}
              >
                Calculator
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {page === 'dashboard' && trades.length > 0 && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  aria-label="Upload CSV to update data"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs font-medium text-stone-500 hover:text-stone-800 hover:bg-stone-100 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-1"
                  title="Upload another CSV to replace data"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload CSV
                </button>
              </>
            )}
            {page === 'dashboard' && trades.length > 0 && yearsWithData.length > 0 && (
              <>
                <span className="text-xs font-medium text-stone-500 hidden sm:inline">Period</span>
                <select
                  value={statsPeriod === 'total' ? 'total' : statsPeriod}
                  onChange={(e) => {
                    const v = e.target.value;
                    startTransition(() => {
                      setStatsPeriod(v === 'total' ? 'total' : parseInt(v, 10));
                    });
                  }}
                  className="text-sm font-medium text-stone-800 bg-white border border-stone-200 rounded-lg py-2 pl-3 pr-9 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-2 cursor-pointer"
                  aria-label="View stats for period"
                >
                  <option value="total">All time</option>
                  {yearsWithData.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </>
            )}
            {page === 'dashboard' && trades.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Clear all uploaded data? This cannot be undone.')) {
                    clearData();
                  }
                }}
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

      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
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
              className="max-w-2xl mx-auto"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">Dashboard</h2>
                <p className="text-stone-600 mt-2 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
                  Upload your Webull options CSV to see PnL, win rate, and rule consistency.
                </p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileUpload}
                className={cn(
                  'relative rounded-2xl border-2 border-dashed p-10 sm:p-12 flex flex-col items-center justify-center gap-6 transition-all duration-200 min-h-[280px] card',
                  isDragging
                    ? 'border-stone-500 bg-stone-100 scale-[1.01]'
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50/50'
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
                    'w-20 h-20 rounded-2xl flex items-center justify-center pointer-events-none transition-all',
                    isDragging ? 'bg-stone-800 scale-110' : 'bg-stone-100'
                  )}
                >
                  <Upload className={cn('w-10 h-10', isDragging ? 'text-white' : 'text-stone-500')} strokeWidth={2} />
                </div>
                <div className="pointer-events-none text-center space-y-3">
                  <p className="text-lg font-semibold text-stone-900">Drop your CSV here or click to browse</p>
                  <p className="text-sm text-stone-500">Webull: Account → Orders → Export</p>
                </div>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 w-full max-w-sm bg-rose-50 text-rose-800 px-4 py-3 rounded-xl text-sm font-medium border border-rose-200 shadow-sm"
                  >
                    {error}
                  </motion.div>
                )}
                <button
                  type="button"
                  onClick={loadSampleData}
                  className="relative z-10 text-sm font-semibold text-stone-700 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-5 py-2.5 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2"
                >
                  Load sample data instead
                </button>
              </div>

              <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-6 text-center">
                {[
                  { icon: Shield, label: 'Data stays in your browser' },
                  { icon: Zap, label: 'Auto-detects Webull columns' },
                  { icon: LineChartIcon, label: 'PnL chart + 20-day SMA' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 text-stone-600 text-sm font-medium">
                    <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-stone-500" strokeWidth={2} />
                    </div>
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
              className="space-y-10 sm:space-y-12"
            >
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-rose-50 text-rose-800 px-4 py-3 rounded-xl text-base font-medium border border-rose-200 shadow-sm flex items-center justify-between gap-4"
                >
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-rose-600 hover:text-rose-800 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 rounded p-1"
                    aria-label="Dismiss"
                  >
                    ×
                  </button>
                </motion.div>
              )}
              {/* PnL chart — at top, no heading */}
              <section className="space-y-4">
                <div
                  className="card overflow-hidden"
                  onMouseEnter={() => setChartHovered(true)}
                  onMouseLeave={() => setChartHovered(false)}
                >
                <div className="p-5 sm:p-6 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <p className="text-base text-stone-500 max-w-xl leading-snug">
                      {chartPeriod === 'daily' && 'Cumulative by day. Below SMA = consider reducing size. '}
                      Hover to highlight stats. Period follows Overview selector.
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-0.5 p-1.5 rounded-xl bg-stone-100">
                        {(['daily', 'monthly', 'yearly'] as const).map((period) => (
                          <button
                            key={period}
                            type="button"
                            onClick={() => setChartPeriod(period)}
                            className={cn(
                              'px-4 py-2.5 text-sm font-medium rounded-lg capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2',
                              chartPeriod === period ? 'bg-white text-stone-900 shadow-sm border border-stone-200' : 'text-stone-500 hover:text-stone-800'
                            )}
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                      {chartPeriod === 'daily' && (
                        <>
                          <span className="text-sm text-stone-500">20-day SMA</span>
                          <button
                            type="button"
                            onClick={() => setShowSma(!showSma)}
                            className={cn(
                              'px-4 py-2.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-offset-2',
                              showSma ? 'bg-stone-800 text-white shadow-sm' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
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
                    <div className="flex items-center gap-5 text-base text-stone-600">
                      <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-stone-700 rounded-full" />Cumulative</span>
                      {chartPeriod === 'daily' && showSma && <span className="flex items-center gap-2"><span className="w-3 h-0.5 border-t-2 border-dashed border-amber-500" />20-day SMA</span>}
                    </div>
                  )}
                </div>
                <div className="h-[380px] sm:h-[420px] w-full border-t border-stone-100 bg-stone-50/50">
                  {chartData.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                      <LineChartIcon className="w-10 h-10 text-stone-300" strokeWidth={1.5} />
                      <p className="text-base font-medium text-stone-500">No PnL data yet</p>
                      <p className="text-base text-stone-400 max-w-xs">Upload a CSV or load sample data.</p>
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
                                <div className="font-semibold text-stone-900 text-base">{dateLabel}</div>
                              </div>
                              <div className="px-4 py-3 space-y-2">
                                <div className="flex justify-between gap-6">
                                  <span className="text-stone-500 text-base">{periodLabel} P/L</span>
                                  <span className={cn('font-semibold tabular-nums text-base', point.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                    {point.pnl >= 0 ? '+' : ''}${point.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                                {chartPeriod === 'daily' && point.rolling5DayPnl != null && (
                                  <div className="flex justify-between gap-6">
                                    <span className="text-stone-500 text-base">5-day rolling</span>
                                    <span className={cn('font-semibold tabular-nums text-base', point.rolling5DayPnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                      {point.rolling5DayPnl >= 0 ? '+' : ''}${point.rolling5DayPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between gap-6 pt-1 border-t border-stone-100">
                                  <span className="text-stone-500 text-base">Cumulative</span>
                                  <span className="font-semibold tabular-nums text-base text-stone-900">
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
                </div>
              </section>

              {/* Stats + insights — compact, under PnL chart (no "Overview" label) */}
              <section className="space-y-4">
                {/* Single stats card: Total PnL + metrics */}
                <div className={cn('card overflow-hidden', chartHovered && 'border-stone-300 shadow-md')}>
                  <div className="p-5 sm:p-6 border-b border-stone-100 bg-stone-50/50">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 sm:gap-6">
                      <div>
                        <p className="text-base font-medium text-stone-600">Total PnL</p>
                        <p
                          className={cn(
                            'text-3xl sm:text-4xl font-bold tracking-tight tabular-nums mt-1.5',
                            stats?.trend === 'up' && 'text-emerald-600',
                            stats?.trend === 'down' && 'text-rose-600',
                            stats?.trend !== 'up' && stats?.trend !== 'down' && 'text-stone-900'
                          )}
                        >
                          {stats?.totalPnl ?? '$0'}
                        </p>
                      </div>
                      <div className="flex gap-8 sm:gap-10">
                        <div>
                          <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">5-day</p>
                          <p className={cn('text-xl font-bold tabular-nums mt-1', stats?.rolling5Trend === 'up' ? 'text-emerald-600' : stats?.rolling5Trend === 'down' ? 'text-rose-600' : 'text-stone-800')}>
                            {stats?.rolling5DayPnl ?? '$0'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">Trades</p>
                          <p className="text-xl font-bold tabular-nums text-stone-800 mt-1">{stats?.tradeCount ?? '0'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5 sm:gap-x-10 lg:gap-x-12">
                      <div>
                        <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">Win rate</p>
                        <p className="text-lg font-bold tabular-nums text-stone-800 mt-1">{stats?.winRate ?? '0%'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">Edge</p>
                        <p className={cn('text-lg font-bold tabular-nums mt-1', (stats?.expectancy ?? 0) > 0 ? 'text-emerald-600' : (stats?.expectancy ?? 0) < 0 ? 'text-rose-600' : 'text-stone-800')}>
                          {stats?.expectancyFormatted ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">Expectancy</p>
                        <p className={cn('text-lg font-bold tabular-nums mt-1', (stats?.expectancyMetric ?? 0) > 0 ? 'text-emerald-600' : (stats?.expectancyMetric ?? 0) < 0 ? 'text-rose-600' : 'text-stone-800')}>
                          {stats?.expectancyMetricFormatted ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">SQN</p>
                        <p className={cn('text-lg font-bold tabular-nums mt-1', (stats?.sqn ?? 0) >= 2 ? 'text-emerald-600' : (stats?.sqn ?? 0) > 0 && (stats?.sqn ?? 0) < 1.5 ? 'text-rose-600' : 'text-stone-800')}>
                          {stats?.sqnFormatted ?? '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">Avg win</p>
                        <p className="text-lg font-bold tabular-nums text-emerald-600 mt-1">{stats?.avgWin ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">Avg loss</p>
                        <p className="text-lg font-bold tabular-nums text-rose-600 mt-1">{stats?.avgLoss ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">Avg win %</p>
                        <p className="text-lg font-bold tabular-nums text-emerald-600 mt-1">{stats?.avgWinPctFormatted ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-600 uppercase tracking-wider">Avg loss %</p>
                        <p className="text-lg font-bold tabular-nums text-rose-600 mt-1">{stats?.avgLossPctFormatted ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insights — spaced for readability */}
                <div className="card p-5 sm:p-6 bg-stone-50/60">
                  <p className="text-base font-semibold text-stone-800 mb-1">Insights</p>
                  <p className="text-sm text-stone-600 mb-4">What to consider based on your stats.</p>
                  <ul className="space-y-4 text-base text-stone-600 leading-relaxed">
                    {stats?.sqn != null && (
                      <li className="flex gap-3">
                        <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-stone-700">SQN ({stats.sqnFormatted})</strong>
                          {stats.sqn >= 3 && ' — Excellent. Consider scaling if risk rules allow.'}
                          {stats.sqn >= 2 && stats.sqn < 3 && ' — Good. Trade with discipline.'}
                          {stats.sqn >= 1.5 && stats.sqn < 2 && ' — Average. Focus on consistency.'}
                          {(stats.sqn < 1.5 || stats.sqn === 0) && ' — Poor. Reduce size or improve entries/exits.'}
                        </span>
                      </li>
                    )}
                    {stats?.expectancy != null && (
                      <li className="flex gap-3">
                        <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-stone-700">Edge</strong>
                          {stats.expectancy > 0 && ' — Positive. Stick to your plan.'}
                          {stats.expectancy < 0 && ' — Negative. Tighten stops or revise strategy.'}
                          {stats.expectancy === 0 && ' — Breakeven before costs.'}
                        </span>
                      </li>
                    )}
                    {(stats?.expectancyMetric ?? 0) > 0 && (
                      <li className="flex gap-3">
                        <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                        <span><strong className="text-stone-700">Expectancy</strong> — Positive per $ risked. Size accordingly; avoid overbetting.</span>
                      </li>
                    )}
                    {(stats?.expectancyMetric ?? 0) < 0 && (
                      <li className="flex gap-3">
                        <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                        <span><strong className="text-stone-700">Expectancy</strong> — Negative. Reduce size until profitable.</span>
                      </li>
                    )}
                    {stats?.breakevenWinRate != null && (
                      <li
                        className={cn(
                          'flex gap-3',
                          stats.aboveBreakeven === true && 'text-emerald-700',
                          stats.aboveBreakeven === false && 'text-rose-700',
                          stats.aboveBreakeven === null && 'text-stone-600'
                        )}
                      >
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-stone-700">Win rate vs breakeven ({stats.breakevenWinRate})</strong>
                          {stats.aboveBreakeven === true && ' — Above. Win rate supports edge.'}
                          {stats.aboveBreakeven === false && ' — Below. Cut losses or let winners run.'}
                        </span>
                      </li>
                    )}
                    {stats?.rolling5Trend === 'down' && (
                      <li className="flex gap-3">
                        <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                        <span><strong className="text-stone-700">5-day rolling</strong> — Negative. Consider reducing size.</span>
                      </li>
                    )}
                    {stats?.rolling5Trend === 'up' && (
                      <li className="flex gap-3">
                        <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                        <span><strong className="text-stone-700">5-day rolling</strong> — Positive. Stay disciplined.</span>
                      </li>
                    )}
                    <li className="flex gap-3 text-stone-500 pt-3 mt-3 border-t border-stone-200">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Use your daily loss limit and consistency % to avoid overtrading on bad days.</span>
                    </li>
                  </ul>
                </div>
              </section>

              {/* Rules, monthly & risk — two columns inline, aligned at top */}
              <section className="space-y-5">
                <h2 className="section-title">Rules, monthly & risk</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">
                {/* Left column: Daily loss limit + Consecutive losses */}
                <div className="space-y-5 flex flex-col">
                  {/* Daily loss limit */}
                  <div
                    className={cn(
                      'card overflow-hidden',
                      stats?.ruleDaysBroke === 0 ? 'bg-emerald-50/80 border-emerald-200/80' : 'bg-amber-50/80 border-amber-200/80'
                    )}
                  >
                    <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn('p-2.5 rounded-xl shrink-0', stats?.ruleDaysBroke === 0 ? 'bg-emerald-500/10' : 'bg-amber-500/10')}>
                          <ShieldCheck className={cn('w-5 h-5', stats?.ruleDaysBroke === 0 ? 'text-emerald-600' : 'text-amber-600')} strokeWidth={2.25} />
                        </div>
                        <div>
                          <p className="text-base font-medium text-stone-600 mb-2">Daily loss limit</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base text-stone-600">Stop after</span>
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
                            <span className="text-base text-stone-600">loss{maxLossesPerDay !== 1 ? 'es' : ''} per day</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-5 sm:pl-5 sm:border-l sm:border-stone-200/70">
                        <div>
                          <p className="text-base font-medium text-stone-600 mb-1">Consistency</p>
                          <p className={cn('text-2xl font-bold tabular-nums', stats?.ruleDaysBroke === 0 ? 'text-emerald-700' : 'text-amber-700')}>
                            {stats?.ruleConsistency ?? '—'}
                          </p>
                        </div>
                        {stats?.ruleTotalDays != null && stats.ruleTotalDays > 0 && (
                          <p className="text-base text-stone-600">
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

                  {/* Consecutive losses — same column, no empty space */}
                  <div className="card overflow-hidden">
                    <div className="card-header px-5 sm:px-6 py-3.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                        <div>
                          <p className="text-base font-semibold text-stone-800">Consecutive losses</p>
                          <p className="text-sm text-stone-500 mt-1">P(N in a row). Max observed: <strong className="text-stone-700">{stats?.maxConsecutiveLossesObserved ?? 0}</strong></p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-medium text-stone-500">Current streak</p>
                          <p className={cn('text-xl font-bold tabular-nums', (stats?.currentLossStreak ?? 0) > 0 ? 'text-rose-600' : 'text-stone-400')}>
                            {stats?.currentLossStreak ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                    {stats?.consecutiveLossProbs && stats.consecutiveLossProbs.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-base">
                          <thead>
                            <tr className="border-b border-stone-200 bg-stone-50/80">
                              <th className="text-left py-2.5 px-4 sm:px-5 text-sm font-semibold text-stone-600 uppercase tracking-wider">N</th>
                              <th className="text-right py-2.5 px-4 sm:px-5 text-sm font-semibold text-stone-600 uppercase tracking-wider">Probability</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.consecutiveLossProbs.map((row, i) => (
                              <tr key={row.streak} className={cn('border-b border-stone-100 hover:bg-stone-50/80 transition-colors', i % 2 === 1 && 'bg-stone-50/30')}>
                                <td className="py-2.5 px-4 sm:px-5 font-medium text-stone-800 text-base">{row.streak}</td>
                                <td className="py-2.5 px-4 sm:px-5 text-right tabular-nums font-medium text-stone-700 text-base">{row.probFormatted}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="px-5 py-4 text-center text-base text-stone-500">No loss data for this period.</div>
                    )}
                  </div>
                </div>

                {/* Right column: PnL by month + Strategy by calendar month */}
                <div className="space-y-5 flex flex-col">
                  {/* PnL by month — only when a specific year is selected (hidden for All time) */}
                  {statsPeriod !== 'total' && stats?.monthsList && stats.monthsList.length > 0 && (
                    <div className="card overflow-hidden">
                      <div className="card-header px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-stone-800">PnL by month</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-stone-500">Sort</span>
                          <select
                            value={monthSort}
                            onChange={(e) => setMonthSort(e.target.value as 'best' | 'worst' | 'date')}
                            className="text-sm font-medium text-stone-800 bg-white border border-stone-200 rounded-xl py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-2 cursor-pointer"
                            aria-label="Sort months by"
                          >
                            <option value="best">Best first</option>
                            <option value="worst">Worst first</option>
                            <option value="date">Date</option>
                          </select>
                        </div>
                      </div>
                      <ul className="divide-y divide-stone-100">
                        {[...stats.monthsList]
                          .filter((m) => statsPeriod === 'total' || m.monthKey.startsWith(String(statsPeriod)))
                          .sort((a, b) => {
                            if (monthSort === 'best') return (b.pct ?? -Infinity) - (a.pct ?? -Infinity);
                            if (monthSort === 'worst') return (a.pct ?? Infinity) - (b.pct ?? Infinity);
                            return a.monthKey.localeCompare(b.monthKey);
                          })
                          .map((month) => (
                            <li
                              key={month.monthKey}
                              className="flex items-center justify-between px-5 sm:px-6 py-3 hover:bg-stone-50/80 transition-colors"
                            >
                              <span className="text-base font-medium text-stone-800">{month.label}</span>
                              <span
                                className={cn(
                                  'text-base font-semibold tabular-nums',
                                  month.pct != null && month.pct > 0 && 'text-emerald-600',
                                  month.pct != null && month.pct < 0 && 'text-rose-600',
                                  (month.pct == null || month.pct === 0) && 'text-stone-400'
                                )}
                              >
                                {month.pctFormatted}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                  {/* Strategy by calendar month — only when "All time" is selected */}
                  {statsPeriod === 'total' && stats?.calendarMonthAvgList && stats.calendarMonthAvgList.length > 0 && (
                    <div className="card overflow-hidden">
                      <div className="card-header px-5 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-stone-800">Strategy by calendar month</p>
                          <p className="text-base text-stone-500 mt-1">Full years only. Excludes {new Date().getFullYear()}.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-stone-500">Sort</span>
                          <select
                            value={calendarMonthSort}
                            onChange={(e) => setCalendarMonthSort(e.target.value as 'best' | 'worst' | 'date')}
                            className="text-sm font-medium text-stone-800 bg-white border border-stone-200 rounded-xl py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-stone-300 focus:ring-offset-2 cursor-pointer"
                            aria-label="Sort calendar months by"
                          >
                            <option value="worst">Worst first</option>
                            <option value="best">Best first</option>
                            <option value="date">Date (Jan–Dec)</option>
                          </select>
                        </div>
                      </div>
                      <ul className="divide-y divide-stone-100">
                        {[...stats.calendarMonthAvgList]
                          .sort((a, b) => {
                            if (calendarMonthSort === 'best') return (b.avgPct ?? -Infinity) - (a.avgPct ?? -Infinity);
                            if (calendarMonthSort === 'worst') return (a.avgPct ?? Infinity) - (b.avgPct ?? Infinity);
                            return a.monthNum - b.monthNum;
                          })
                          .map((row) => {
                            const isCurrentMonth = row.monthNum === new Date().getMonth() + 1;
                            return (
                          <li
                            key={row.name}
                            className={cn(
                              'flex items-center justify-between px-5 sm:px-6 py-3 transition-colors',
                              isCurrentMonth ? 'bg-amber-50/80 hover:bg-amber-50' : 'hover:bg-stone-50/80'
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span className="text-base font-medium text-stone-800">{row.name}</span>
                              {isCurrentMonth && (
                                <span className="text-xs font-medium text-amber-700 bg-amber-200/70 px-2 py-0.5 rounded-md">Current month</span>
                              )}
                            </span>
                            <span
                              className={cn(
                                'text-base font-semibold tabular-nums',
                                row.avgPct != null && row.avgPct > 0 && 'text-emerald-600',
                                row.avgPct != null && row.avgPct < 0 && 'text-rose-600',
                                (row.avgPct == null || row.avgPct === 0) && 'text-stone-400'
                              )}
                            >
                              {row.pctFormatted}
                            </span>
                          </li>
                            );
                          })}
                      </ul>
                    </div>
                  )}
                </div>
                </div>
              </section>

              {/* Activity — Recent trades */}
              <section className="space-y-4">
                <h2 className="section-title">Activity</h2>
                <div className="card overflow-hidden">
                  <div className="card-header px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-stone-900">Recent trades</h3>
                    {tradesTotalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-base text-stone-500 tabular-nums">
                          {(currentTradesPage - 1) * TRADES_PAGE_SIZE + 1}–{Math.min(currentTradesPage * TRADES_PAGE_SIZE, groupedTradesForActivity.length)} of {groupedTradesForActivity.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTradesPage((p) => Math.max(1, p - 1))}
                          disabled={currentTradesPage <= 1}
                          className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTradesPage((p) => Math.min(tradesTotalPages, p + 1))}
                          disabled={currentTradesPage >= tradesTotalPages}
                          className="p-2 rounded-lg text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2"
                          aria-label="Next page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" role="table">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50/80">
                          <th className="text-left py-3 pl-5 pr-2 sm:pl-6 sm:pr-3 text-sm font-semibold text-stone-600 uppercase tracking-wider w-0" aria-label="Expand" />
                          <th className="text-left py-3 px-4 sm:px-5 text-sm font-semibold text-stone-600 uppercase tracking-wider w-[7rem] sm:w-36">Date</th>
                          <th className="text-left py-3 px-4 sm:px-5 text-sm font-semibold text-stone-600 uppercase tracking-wider w-20 sm:w-24">Underlying</th>
                          <th className="text-left py-3 px-4 sm:px-5 text-sm font-semibold text-stone-600 uppercase tracking-wider w-14 sm:w-16">Type</th>
                          <th className="text-right py-3 px-4 sm:px-5 text-sm font-semibold text-stone-600 uppercase tracking-wider w-18 sm:w-22">Strike</th>
                          <th className="text-right py-3 px-4 sm:px-5 text-sm font-semibold text-stone-600 uppercase tracking-wider w-20 sm:w-24">Return %</th>
                          <th className="text-right py-3 pr-5 pl-4 sm:pr-6 sm:pl-5 text-sm font-semibold text-stone-600 uppercase tracking-wider w-24 sm:w-28">PnL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTrades.map((trade, i) => {
                          const dayKey = format(trade.date, 'yyyy-MM-dd');
                          const tradeKey = `${dayKey}_${trade.symbol}`;
                          const isExpanded = expandedTradeKey === tradeKey;
                          const occ = parseOccSymbol(trade.symbol);
                          const underlyingFills = tradesForStats.filter(
                            (t) => format(t.date, 'yyyy-MM-dd') === dayKey && t.symbol === trade.symbol
                          );
                          const hasFills = underlyingFills.length > 0;
                          const handleRowClick = () => hasFills && setExpandedTradeKey((k) => (k === tradeKey ? null : tradeKey));
                          return (
                            <React.Fragment key={`${dayKey}-${trade.symbol}-${i}`}>
                              <tr
                                role={hasFills ? 'button' : undefined}
                                tabIndex={hasFills ? 0 : undefined}
                                onClick={hasFills ? handleRowClick : undefined}
                                onKeyDown={hasFills ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleRowClick()) : undefined}
                                className={cn(
                                  'border-b border-stone-100 transition-colors',
                                  hasFills && 'cursor-pointer hover:bg-stone-50/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 focus-visible:ring-inset',
                                  isExpanded && 'bg-stone-50/60'
                                )}
                              >
                                <td className="py-3 pl-5 pr-2 sm:pl-6 sm:pr-3 align-middle w-0">
                                  {hasFills ? (
                                    <ChevronDown className={cn('w-4 h-4 text-stone-400 shrink-0 transition-transform', isExpanded && 'rotate-180')} aria-hidden />
                                  ) : (
                                    <span className="w-4 inline-block" aria-hidden />
                                  )}
                                </td>
                                <td className="py-3 px-4 sm:px-5 text-base text-stone-600 tabular-nums whitespace-nowrap">
                                  {format(trade.date, 'MMM d, yyyy')}
                                </td>
                                <td className="py-3 px-4 sm:px-5 text-base font-semibold text-stone-900">{occ?.underlying ?? '—'}</td>
                                <td className="py-3 px-4 sm:px-5">
                                  {occ ? (
                                    <span className={cn('inline-block px-2 py-0.5 rounded text-sm font-semibold', occ.optionType === 'Call' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>
                                      {occ.optionType}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="py-3 px-4 sm:px-5 text-right text-base tabular-nums text-stone-700 font-medium">{occ != null ? `$${occ.strike.toFixed(2)}` : '—'}</td>
                                <td className="py-3 px-4 sm:px-5 text-right">
                                  {(() => {
                                    const costFromFills = underlyingFills.length > 0
                                      ? underlyingFills
                                          .filter((f) => f.type === trade.type)
                                          .reduce((sum, f) => sum + f.quantity * f.price * OPTION_MULTIPLIER, 0)
                                      : 0;
                                    const cost = costFromFills > 0 ? costFromFills : trade.quantity * trade.price * OPTION_MULTIPLIER;
                                    const pct = cost > 0 ? (trade.pnl / cost) * 100 : null;
                                    if (pct == null) return <span className="text-base tabular-nums text-stone-400">—</span>;
                                    return (
                                      <span
                                        className={cn(
                                          'text-base font-semibold tabular-nums',
                                          trade.pnl > 0 && 'text-emerald-600',
                                          trade.pnl < 0 && 'text-rose-600',
                                          trade.pnl === 0 && 'text-stone-400'
                                        )}
                                      >
                                        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="py-3 pr-5 pl-4 sm:pr-6 sm:pl-5 text-right">
                                  <span
                                    className={cn(
                                      'text-base font-semibold tabular-nums',
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
                                <tr className="bg-stone-50/60">
                                  <td colSpan={7} className="px-5 sm:px-6 py-4 align-top border-b border-stone-100">
                                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2">
                                      <p className="text-sm font-semibold text-stone-500 uppercase tracking-wider">Fills ({underlyingFills.length})</p>
                                      <span className="font-mono text-sm text-stone-400" title="OCC symbol">{trade.symbol}</span>
                                    </div>
                                    <table className="w-full text-base border-collapse">
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
                                              <span className={cn('inline-block px-2 py-0.5 rounded text-sm font-semibold', fill.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
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

      <footer className="mt-auto py-6 sm:py-8 border-t border-stone-200 bg-white/80">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-base text-stone-500">TradePulse · Webull options PnL. Data stays in your browser.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-base text-stone-500 hover:text-stone-800 transition-colors">Privacy</a>
            <a href="#" className="text-base text-stone-500 hover:text-stone-800 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
