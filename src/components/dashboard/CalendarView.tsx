'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  format, addMonths, subMonths, isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight, X, BookOpen, ChevronRight as ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { parseOccSymbol } from '@/hooks/useTradeStats';

interface GroupedTrade {
  date: Date;
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  pnl: number;
}

interface DayStats {
  pnl: number;
  trades: GroupedTrade[];
  wins: number;
  losses: number;
}

interface CalendarViewProps {
  trades: GroupedTrade[];
}

// ── Main Component ──────────────────────────────────────────────────

export function CalendarView({ trades }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Default to the month of the most recent trade, or current month
    if (trades.length > 0) {
      const sorted = [...trades].sort((a, b) => b.date.getTime() - a.date.getTime());
      return startOfMonth(sorted[0].date);
    }
    return startOfMonth(new Date());
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reviewedDates, setReviewedDates] = useState<Set<string>>(new Set());

  // Fetch which dates have been journaled from Supabase
  useEffect(() => {
    fetch('/api/trades/reviewed-dates')
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.dates) setReviewedDates(new Set(json.dates));
      })
      .catch(() => {});
  }, []);

  // Build day-level stats map from trades
  const dayStatsMap = useMemo(() => {
    const map = new Map<string, DayStats>();
    for (const t of trades) {
      const key = format(t.date, 'yyyy-MM-dd');
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          pnl: t.pnl,
          trades: [t],
          wins: t.pnl > 0 ? 1 : 0,
          losses: t.pnl < 0 ? 1 : 0,
        });
      } else {
        existing.pnl += t.pnl;
        existing.trades.push(t);
        if (t.pnl > 0) existing.wins++;
        if (t.pnl < 0) existing.losses++;
      }
    }
    return map;
  }, [trades]);

  // Calendar grid cells for current month
  const gridCells = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDow = getDay(monthStart); // 0=Sun

    const cells: (Date | null)[] = [
      ...Array(startDow).fill(null),
      ...days,
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [currentMonth]);

  // Month summary stats
  const monthSummary = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM');
    let totalPnl = 0;
    let totalTrades = 0;
    let greenDays = 0;
    let tradingDays = 0;

    for (const [key, stats] of dayStatsMap) {
      if (key.startsWith(monthStr)) {
        totalPnl += stats.pnl;
        totalTrades += stats.trades.length;
        tradingDays++;
        if (stats.pnl > 0) greenDays++;
      }
    }
    return { totalPnl, totalTrades, greenDays, tradingDays };
  }, [dayStatsMap, currentMonth]);

  const goToPrevMonth = () => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDate(null); };
  const goToNextMonth = () => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDate(null); };

  const handleDayClick = useCallback((dateStr: string) => {
    setSelectedDate(prev => prev === dateStr ? null : dateStr);
  }, []);

  const selectedDayStats = selectedDate ? dayStatsMap.get(selectedDate) : null;

  const fmtMoney = (v: number) => {
    const abs = Math.abs(v);
    const str = abs >= 1000 ? `$${(abs / 1000).toFixed(1)}k` : `$${abs.toFixed(0)}`;
    return v >= 0 ? `+${str}` : `-${str}`;
  };

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <button onClick={goToPrevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors text-stone-500 hover:text-stone-800">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-base font-bold text-stone-900 tracking-tight min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <button onClick={goToNextMonth} className="p-1.5 rounded-lg hover:bg-stone-100 transition-colors text-stone-500 hover:text-stone-800">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-5 text-xs font-medium text-stone-500">
          <span>{monthSummary.totalTrades} trades</span>
          <span>{monthSummary.greenDays}/{monthSummary.tradingDays} green days</span>
          <span className={`font-mono font-bold ${monthSummary.totalPnl > 0 ? 'text-emerald-600' : monthSummary.totalPnl < 0 ? 'text-rose-600' : 'text-stone-500'}`}>
            {fmtMoney(monthSummary.totalPnl)}
          </span>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-stone-100">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {gridCells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-stone-50 bg-stone-25" />;
          const dateStr = format(day, 'yyyy-MM-dd');
          const stats = dayStatsMap.get(dateStr);
          const isSelected = dateStr === selectedDate;
          const today = isToday(day);

          return (
            <DayCell
              key={dateStr}
              day={day}
              stats={stats}
              isToday={today}
              isSelected={isSelected}
              isReviewed={reviewedDates.has(dateStr)}
              onClick={() => stats && handleDayClick(dateStr)}
            />
          );
        })}
      </div>

      {/* Trade detail panel */}
      {selectedDate && selectedDayStats && (
        <TradeDetailPanel
          date={selectedDate}
          stats={selectedDayStats}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </div>
  );
}

// ── Day Cell ────────────────────────────────────────────────────────

function DayCell({ day, stats, isToday: today, isSelected, isReviewed, onClick }: {
  day: Date;
  stats?: DayStats;
  isToday: boolean;
  isSelected: boolean;
  isReviewed: boolean;
  onClick: () => void;
}) {
  const hasTrades = !!stats;
  const pnl = stats?.pnl ?? 0;
  const isGreen = pnl > 0;
  const isRed = pnl < 0;
  const winRate = stats ? Math.round((stats.wins / stats.trades.length) * 100) : 0;

  return (
    <div
      onClick={hasTrades ? onClick : undefined}
      className={`
        min-h-[80px] p-2 border-b border-r border-stone-100 transition-all relative
        ${hasTrades ? 'cursor-pointer hover:bg-stone-50' : ''}
        ${isSelected ? 'bg-stone-100 ring-1 ring-inset ring-stone-300' : ''}
        ${isGreen && !isSelected ? 'bg-emerald-50/40' : ''}
        ${isRed && !isSelected ? 'bg-rose-50/40' : ''}
      `}
    >
      {/* Day number + reviewed icon */}
      <div className="flex items-center justify-between">
        <div className={`text-xs font-medium ${today ? 'text-blue-600 font-bold' : 'text-stone-400'}`}>
          {format(day, 'd')}
          {today && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-500 align-middle" />}
        </div>
        {isReviewed && (
          <BookOpen className="w-3 h-3 text-violet-400" />
        )}
      </div>

      {hasTrades && (
        <>
          {/* P&L */}
          <div className={`mt-1.5 font-mono text-sm font-bold ${isGreen ? 'text-emerald-600' : isRed ? 'text-rose-600' : 'text-stone-500'}`}>
            {pnl > 0 ? '+' : ''}{pnl.toFixed(0)}
          </div>
          {/* Trade count + win rate */}
          <div className="mt-0.5 text-[10px] font-medium text-stone-400">
            {stats!.trades.length}t · {winRate}%w
          </div>
        </>
      )}
    </div>
  );
}

// ── Trade Detail Panel ──────────────────────────────────────────────

function TradeDetailPanel({ date, stats, onClose }: {
  date: string;
  stats: DayStats;
  onClose: () => void;
}) {
  const router = useRouter();
  const fmtDate = (() => {
    try {
      const [y, m, d] = date.split('-').map(Number);
      return format(new Date(y, m - 1, d), 'EEEE, MMMM d, yyyy');
    } catch { return date; }
  })();

  return (
    <div className="border-t border-stone-200 bg-stone-50/50">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-stone-100">
        <div className="flex items-center gap-4">
          <h4 className="text-sm font-bold text-stone-800">{fmtDate}</h4>
          <span className={`font-mono text-sm font-bold ${stats.pnl > 0 ? 'text-emerald-600' : stats.pnl < 0 ? 'text-rose-600' : 'text-stone-500'}`}>
            {stats.pnl > 0 ? '+' : ''}{stats.pnl.toFixed(2)}
          </span>
          <span className="text-xs font-medium text-stone-400">
            {stats.wins}W {stats.losses}L
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-200 transition-colors text-stone-400 hover:text-stone-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Trade table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100">
              <th className="text-left py-2.5 px-6 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Contract</th>
              <th className="text-left py-2.5 px-4 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Type</th>
              <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Qty</th>
              <th className="text-right py-2.5 px-4 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Avg Price</th>
              <th className="text-right py-2.5 px-6 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">P/L</th>
            </tr>
          </thead>
          <tbody>
            {stats.trades
              .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
              .map((trade, i) => {
                const parsed = parseOccSymbol(trade.symbol);
                const contractLabel = parsed
                  ? `${parsed.underlying} ${parsed.expiration} $${parsed.strike} ${parsed.optionType}`
                  : trade.symbol;

                return (
                  <tr
                    key={`${trade.symbol}-${i}`}
                    onClick={() => router.push(`/journal/${date}?symbol=${encodeURIComponent(trade.symbol)}`)}
                    className="border-b border-stone-50 last:border-b-0 hover:bg-white/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-2.5 px-6 font-mono text-xs font-medium text-stone-700">{contractLabel}</td>
                    <td className="py-2.5 px-4 text-xs">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        parsed?.optionType === 'Call' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {parsed?.optionType ?? trade.type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-stone-600">{trade.quantity}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-stone-600">${trade.price.toFixed(2)}</td>
                    <td className={`py-2.5 px-6 text-right font-mono text-sm font-bold ${trade.pnl > 0 ? 'text-emerald-600' : trade.pnl < 0 ? 'text-rose-600' : 'text-stone-500'}`}>
                      <span className="flex items-center justify-end gap-2">
                        {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                        <ArrowRight className="w-3.5 h-3.5 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
