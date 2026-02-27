'use client';

import React, { useState, useCallback, useEffect, useRef, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Plus, RefreshCw } from 'lucide-react';

import { useTradeStats, parseOccSymbol, OPTION_MULTIPLIER_VAL } from '@/hooks/useTradeStats';
import { supabaseTradesToClientTrades, type Trade } from '@/utils/pnlParser';

import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { CalendarView } from '@/components/dashboard/CalendarView';
import { InsightsSection } from '@/components/dashboard/InsightsSection';
import { BreakdownSection } from '@/components/dashboard/BreakdownSection';
import { TradeTable } from '@/components/trades/TradeTable';
import { EmptyState } from '@/components/trades/EmptyState';

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tradesPage, setTradesPage] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedTradeKey, setExpandedTradeKey] = useState<string | null>(null);
  const [maxLossesPerDay, setMaxLossesPerDay] = useState(2);
  const [monthSort, setMonthSort] = useState<'best' | 'worst' | 'date'>('date');
  const [calendarMonthSort, setCalendarMonthSort] = useState<'best' | 'worst' | 'date'>('worst');
  const [statsPeriod, setStatsPeriod] = useState<'total' | number>(() => new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [minTrades, setMinTrades] = useState(2);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    yearsWithData,
    groupedTradesForStats,
    tradesForStats,
    stats,
  } = useTradeStats(trades, statsPeriod, maxLossesPerDay, minTrades);

  const TRADES_PAGE_SIZE = 10;
  const tradesTotalPages = Math.max(1, Math.ceil(groupedTradesForStats.length / TRADES_PAGE_SIZE));
  const currentTradesPage = Math.min(tradesPage, tradesTotalPages);
  const displayedTrades = groupedTradesForStats.slice(
    (currentTradesPage - 1) * TRADES_PAGE_SIZE,
    currentTradesPage * TRADES_PAGE_SIZE
  );

  // Fetch trades from Supabase on mount
  const fetchTrades = useCallback(async () => {
    try {
      const res = await fetch('/api/trades');
      if (res.ok) {
        const json = await res.json();
        const dbTrades = json.data ?? json;
        setTrades(supabaseTradesToClientTrades(dbTrades));
      }
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

  // Upload CSV through the import API (preview → confirm)
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

    setUploading(true);
    try {
      // Step 1: Preview — send CSV to get parsed round-trips
      const formData = new FormData();
      formData.append('file', file);
      const previewRes = await fetch('/api/trades/import', { method: 'POST', body: formData });
      if (!previewRes.ok) throw new Error('Failed to parse CSV');
      const preview = await previewRes.json();
      const roundTrips = preview.data?.roundTrips ?? [];
      if (roundTrips.length === 0) {
        setError('No valid round-trip trades found in the CSV.');
        setUploading(false);
        return;
      }

      // Step 2: Confirm — save to Supabase
      const confirmRes = await fetch('/api/trades/import?confirm=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: '', trades: roundTrips }),
      });
      if (!confirmRes.ok) throw new Error('Failed to save trades');
      const result = await confirmRes.json();

      // Step 3: Refresh from Supabase
      await fetchTrades();
      setError(result.data?.count > 0 ? null : 'Trades were already imported (duplicates skipped).');
    } catch {
      setError('Could not import the file. Please upload a valid Webull options CSV.');
    }
    setUploading(false);
    if ('files' in e.target && e.target instanceof HTMLInputElement) e.target.value = '';
  }, [fetchTrades]);

  useEffect(() => { setTradesPage(1); }, [groupedTradesForStats.length]);

  const handleDeleteTrades = async (symbol: string, dateStr: string) => {
    // Find the DB trade IDs matching this symbol+date, then delete via API
    // For now, just refresh after deletion — the TradeTable component handles display
    await fetchTrades();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />

      <AnimatePresence mode="wait">
        {trades.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <EmptyState isDragging={isDragging} setIsDragging={setIsDragging} onFileUpload={handleFileUpload} onLoadSample={() => {}} error={error} />
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
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 border border-stone-200/60 disabled:opacity-50">
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{uploading ? 'Importing...' : 'Upload CSV'}</span>
                </button>
                <button type="button" onClick={() => fetchTrades()} className="text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 border border-stone-200/60">
                  <RefreshCw className="w-3.5 h-3.5" /><span className="hidden sm:inline">Refresh</span>
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
              </div>
            </div>

            <MetricsGrid stats={stats} />

            <div className="grid grid-cols-1 gap-16">
              <CalendarView trades={groupedTradesForStats} />
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
