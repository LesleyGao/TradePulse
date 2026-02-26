'use client';

import React, { useState, useCallback, useEffect, useRef, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

import { useTradeStats, parseOccSymbol, OPTION_MULTIPLIER_VAL } from '@/hooks/useTradeStats';
import { parseBrokerCsv, type Trade } from '@/utils/pnlParser';
import { SAMPLE_CSV } from '@/constants';

import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { PnlChart } from '@/components/dashboard/PnlChart';
import { InsightsSection } from '@/components/dashboard/InsightsSection';
import { BreakdownSection } from '@/components/dashboard/BreakdownSection';
import { TradeTable } from '@/components/trades/TradeTable';
import { EmptyState } from '@/components/trades/EmptyState';
import { TradeEntryForm } from '@/components/trades/TradeEntryForm';

const SAVED_CSV_KEY = 'tradepulse_csv';
const SAVED_TRADES_KEY = 'tradepulse_trades_json';

const getTradeKey = (t: Trade) => {
  const time = t.date instanceof Date ? t.date.getTime() : new Date(t.date).getTime();
  return `${time}_${t.symbol}_${t.type}_${t.quantity}_${t.price}`;
};

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [hasRestoredSaved, setHasRestoredSaved] = useState(false);
  const [showSma, setShowSma] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [tradesPage, setTradesPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedTradeKey, setExpandedTradeKey] = useState<string | null>(null);
  const [maxLossesPerDay, setMaxLossesPerDay] = useState(2);
  const [monthSort, setMonthSort] = useState<'best' | 'worst' | 'date'>('date');
  const [calendarMonthSort, setCalendarMonthSort] = useState<'best' | 'worst' | 'date'>('worst');
  const [statsPeriod, setStatsPeriod] = useState<'total' | number>(() => new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [isAddingTrade, setIsAddingTrade] = useState(false);
  const [minTrades, setMinTrades] = useState(2);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    yearsWithData,
    groupedTradesForStats,
    tradesForStats,
    stats,
    pnlDataForStats
  } = useTradeStats(trades, statsPeriod, maxLossesPerDay, minTrades);

  const TRADES_PAGE_SIZE = 10;
  const tradesTotalPages = Math.max(1, Math.ceil(groupedTradesForStats.length / TRADES_PAGE_SIZE));
  const currentTradesPage = Math.min(tradesPage, tradesTotalPages);
  const displayedTrades = groupedTradesForStats.slice(
    (currentTradesPage - 1) * TRADES_PAGE_SIZE,
    currentTradesPage * TRADES_PAGE_SIZE
  );

  // Restore saved trades from localStorage on mount
  useEffect(() => {
    if (hasRestoredSaved) return;
    setHasRestoredSaved(true);
    try {
      const savedJson = localStorage.getItem(SAVED_TRADES_KEY);
      if (savedJson) {
        const parsed = JSON.parse(savedJson).map((t: any) => ({ ...t, date: new Date(t.date) }));
        if (parsed.length > 0) { setTrades(parsed); return; }
      }
      const savedCsv = localStorage.getItem(SAVED_CSV_KEY);
      if (savedCsv) {
        const parsed = parseBrokerCsv(savedCsv);
        if (parsed.length > 0) setTrades(parsed);
      }
    } catch (e) {
      console.error('Migration failed', e);
    }
  }, [hasRestoredSaved]);

  const saveTrades = useCallback((newTrades: Trade[]) => {
    setTrades(newTrades);
    try { localStorage.setItem(SAVED_TRADES_KEY, JSON.stringify(newTrades)); } catch { }
  }, []);

  const loadSampleData = () => {
    setError(null);
    const parsed = parseBrokerCsv(SAMPLE_CSV);
    saveTrades(parsed);
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    let file: File | null = null;
    if ('files' in e.target && (e.target as HTMLInputElement).files?.length) {
      file = (e.target as HTMLInputElement).files![0]!;
    } else if ('dataTransfer' in e && (e as React.DragEvent).dataTransfer?.files?.length) {
      file = (e as React.DragEvent).dataTransfer.files[0]!;
    }
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseBrokerCsv(text);
      if (parsed.length === 0) {
        setError('No valid options orders found. Use your Webull options order list CSV.');
        return;
      }
      setTrades(prev => {
        const existingKeys = new Set(prev.map(getTradeKey));
        const newTrades = [...prev];
        for (const t of parsed) {
          if (!existingKeys.has(getTradeKey(t))) newTrades.push(t);
        }
        const sorted = newTrades.sort((a, b) => a.date.getTime() - b.date.getTime());
        localStorage.setItem(SAVED_TRADES_KEY, JSON.stringify(sorted));
        return sorted;
      });
      if ('files' in e.target && e.target instanceof HTMLInputElement) e.target.value = '';
    } catch {
      setError('Could not read the file. Please upload a valid Webull options CSV.');
    }
  }, []);

  useEffect(() => { setTradesPage(1); }, [groupedTradesForStats.length]);

  const clearData = () => {
    if (window.confirm('Clear all uploaded data? This cannot be undone.')) {
      try { localStorage.removeItem(SAVED_CSV_KEY); localStorage.removeItem(SAVED_TRADES_KEY); } catch { }
      setTrades([]);
    }
  };

  const handleAddTrade = (t: Trade) => {
    const updated = [...trades, t].sort((a, b) => a.date.getTime() - b.date.getTime());
    saveTrades(updated);
  };

  const handleDeleteTrades = (symbol: string, dateStr: string) => {
    const updated = trades.filter(t => {
      const tDay = format(t.date, 'yyyy-MM-dd');
      return !(tDay === dateStr && t.symbol === symbol);
    });
    saveTrades(updated);
  };

  return (
    <>
      <AnimatePresence>
        {isAddingTrade && (
          <TradeEntryForm onAddTrade={handleAddTrade} onClose={() => setIsAddingTrade(false)} />
        )}
      </AnimatePresence>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />

      <AnimatePresence mode="wait">
        {trades.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <EmptyState isDragging={isDragging} setIsDragging={setIsDragging} onFileUpload={handleFileUpload} onLoadSample={loadSampleData} error={error} />
          </motion.div>
        ) : (
          <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="space-y-16">
            {error && (
              <div className="bg-rose-50 text-rose-800 px-6 py-4 rounded-2xl text-sm font-bold border border-rose-100 flex justify-between items-center group">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="opacity-50 group-hover:opacity-100 transition-opacity">×</button>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl font-black text-stone-900 tracking-tighter">Performance Hub</h1>
                <p className="text-stone-500 font-medium mt-1">
                  {statsPeriod === 'total' ? 'All-time' : `Fiscal Year ${statsPeriod}`} Analytics Overview
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 border border-stone-200/60">
                  <Upload className="w-3.5 h-3.5" /><span className="hidden sm:inline">Upload CSV</span>
                </button>
                <button type="button" onClick={() => setIsAddingTrade(true)} className="text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-stone-200">
                  <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Add Trade</span>
                </button>
                {yearsWithData.length > 0 && (
                  <select
                    value={statsPeriod === 'total' ? 'total' : statsPeriod}
                    onChange={(e) => { const v = e.target.value; startTransition(() => setStatsPeriod(v === 'total' ? 'total' : parseInt(v, 10))); }}
                    className="text-sm font-bold text-stone-800 bg-white border border-stone-200 rounded-xl py-2.5 pl-4 pr-10 focus:ring-2 focus:ring-stone-400 cursor-pointer hover:border-stone-300 transition-colors"
                  >
                    <option value="total">All Time</option>
                    {yearsWithData.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
                <button type="button" onClick={clearData} className="p-2.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100" title="Clear all data">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <MetricsGrid stats={stats} />

            <div className="grid grid-cols-1 gap-16">
              <PnlChart data={pnlDataForStats} chartPeriod={chartPeriod} setChartPeriod={setChartPeriod} showSma={showSma} setShowSma={setShowSma} statsPeriod={statsPeriod} />
              <InsightsSection stats={stats} topWorstSymbols={stats?.top6WorstByUnderlying ?? []} topBestSymbols={stats?.top6BestByUnderlying ?? []} minTrades={minTrades} setMinTrades={setMinTrades} />
              <BreakdownSection
                callsVsPuts={{ total: stats?.tradeCount ?? 0, callPct: stats?.callPct ?? 50, putPct: stats?.putPct ?? 50, callCount: stats?.callCount ?? 0, putCount: stats?.putCount ?? 0, callWinRate: stats?.callWinRate ?? 0, putWinRate: stats?.putWinRate ?? 0, winningType: stats?.winningType }}
                stats={stats} maxLossesPerDay={maxLossesPerDay} setMaxLossesPerDay={setMaxLossesPerDay} statsPeriod={statsPeriod} monthSort={monthSort} setMonthSort={setMonthSort} calendarMonthSort={calendarMonthSort} setCalendarMonthSort={setCalendarMonthSort}
              />
              <TradeTable displayedTrades={displayedTrades} groupedTradesForStats={groupedTradesForStats} currentTradesPage={currentTradesPage} tradesTotalPages={tradesTotalPages} setTradesPage={setTradesPage} pageSize={TRADES_PAGE_SIZE} onRowClick={(key) => setExpandedTradeKey(expandedTradeKey === key ? null : key)} expandedTradeKey={expandedTradeKey} tradesForStats={tradesForStats} parseOccSymbol={parseOccSymbol} OPTION_MULTIPLIER={OPTION_MULTIPLIER_VAL} onDeleteTrades={handleDeleteTrades} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
