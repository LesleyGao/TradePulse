import React, { useState, useCallback, useEffect, useRef, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Hooks & Utils
import { useTradeStats, parseOccSymbol, OPTION_MULTIPLIER_VAL } from './hooks/useTradeStats';
import { parseBrokerCsv, type Trade } from './utils/pnlParser';
import { SAMPLE_CSV } from './constants';

// Components
import { Layout } from './components/Layout';
import { MetricsGrid } from './components/MetricsGrid';
import { PnlChart } from './components/PnlChart';
import { InsightsSection } from './components/InsightsSection';
import { BreakdownSection } from './components/BreakdownSection';
import { TradeTable } from './components/TradeTable';
import { EmptyState } from './components/EmptyState';
import PositionSizeCalculator from './pages/PositionSizeCalculator';

type Page = 'dashboard' | 'calculator';
const SAVED_CSV_KEY = 'tradepulse_csv';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [hasRestoredSaved, setHasRestoredSaved] = useState(false);
  const [showSma, setShowSma] = useState(true);
  const [chartPeriod, setChartPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  const [isDragging, setIsDragging] = useState(false);
  const [expandedTradeKey, setExpandedTradeKey] = useState<string | null>(null);
  const [maxLossesPerDay, setMaxLossesPerDay] = useState(2);
  const [monthSort, setMonthSort] = useState<'best' | 'worst' | 'date'>('date');
  const [calendarMonthSort, setCalendarMonthSort] = useState<'best' | 'worst' | 'date'>('worst');
  const [statsPeriod, setStatsPeriod] = useState<'total' | number>(() => new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    yearsWithData,
    groupedTradesForStats,
    tradesForStats,
    stats,
    pnlDataForStats
  } = useTradeStats(trades, statsPeriod, maxLossesPerDay);

  const displayedTrades = groupedTradesForStats.slice(0, 10);

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

      setTrades(parsed);
      try {
        localStorage.setItem(SAVED_CSV_KEY, text);
      } catch {
        // ignore quota
      }
      if ('files' in e.target && e.target instanceof HTMLInputElement) {
        e.target.value = '';
      }
    } catch (err) {
      setError('Could not read the file. Please upload a valid Webull options CSV.');
    }
  }, []);


  const clearData = () => {
    if (window.confirm('Clear all uploaded data? This cannot be undone.')) {
      try {
        localStorage.removeItem(SAVED_CSV_KEY);
      } catch { }
      setTrades([]);
    }
  };

  const handleRowClick = (key: string) => {
    setExpandedTradeKey(expandedTradeKey === key ? null : key);
  };

  return (
    <Layout
      page={page}
      setPage={setPage}
      hasTrades={trades.length > 0}
      yearsWithData={yearsWithData}
      statsPeriod={statsPeriod}
      handlePeriodChange={(p) => startTransition(() => setStatsPeriod(p))}
      onUploadClick={() => fileInputRef.current?.click()}
      onClearData={clearData}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleFileUpload}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {page === 'calculator' ? (
          <motion.div
            key="calculator"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <PositionSizeCalculator />
          </motion.div>
        ) : trades.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <EmptyState
              isDragging={isDragging}
              setIsDragging={setIsDragging}
              onFileUpload={handleFileUpload}
              onLoadSample={loadSampleData}
              error={error}
            />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-16"
          >
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
              <div className="bg-white px-5 py-3 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-4">
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Sample Size</div>
                  <div className="text-sm font-black text-stone-900">{stats?.tradeCount ?? 0} Fills</div>
                </div>
                <div className="w-px h-8 bg-stone-100" />
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Timeframe</div>
                  <div className="text-sm font-black text-stone-900">{statsPeriod === 'total' ? 'Full History' : statsPeriod}</div>
                </div>
              </div>
            </div>

            <MetricsGrid stats={stats} />

            <div className="grid grid-cols-1 gap-16">
              <PnlChart
                data={pnlDataForStats}
                chartPeriod={chartPeriod}
                setChartPeriod={setChartPeriod}
                showSma={showSma}
                setShowSma={setShowSma}
                statsPeriod={statsPeriod}
              />

              <InsightsSection
                stats={stats}
                topWorstSymbols={stats?.top6WorstByUnderlying ?? []}
                topBestSymbols={stats?.top6BestByUnderlying ?? []}
              />

              <BreakdownSection
                callsVsPuts={{
                  total: stats?.tradeCount ?? 0,
                  callPct: stats?.callPct ?? 50,
                  putPct: stats?.putPct ?? 50,
                  callCount: stats?.callCount ?? 0,
                  putCount: stats?.putCount ?? 0,
                  callWinRate: stats?.callWinRate ?? 0,
                  putWinRate: stats?.putWinRate ?? 0,
                  winningType: stats?.winningType
                }}
                stats={stats}
                maxLossesPerDay={maxLossesPerDay}
                setMaxLossesPerDay={setMaxLossesPerDay}
                statsPeriod={statsPeriod}
                monthSort={monthSort}
                setMonthSort={setMonthSort}
                calendarMonthSort={calendarMonthSort}
                setCalendarMonthSort={setCalendarMonthSort}
              />

              <TradeTable
                displayedTrades={displayedTrades}
                groupedTradesForStats={groupedTradesForStats}
                onRowClick={handleRowClick}
                expandedTradeKey={expandedTradeKey}
                tradesForStats={tradesForStats}
                parseOccSymbol={parseOccSymbol}
                OPTION_MULTIPLIER={OPTION_MULTIPLIER_VAL}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
