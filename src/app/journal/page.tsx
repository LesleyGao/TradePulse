'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Upload, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import { parseBrokerCsv, type Trade } from '@/utils/pnlParser';

interface DailySummary {
  id: number;
  date: string;
  total_pnl: number;
  trade_count: number;
  win_count: number;
  loss_count: number;
  be_count: number;
  regime_predicted: string | null;
  regime_actual: string | null;
  user_notes: string | null;
}

const REGIME_COLORS: Record<string, string> = {
  'Pinning': 'bg-violet-100 text-violet-800',
  'Grinding': 'bg-amber-100 text-amber-800',
  'Breakout-Ready': 'bg-blue-100 text-blue-800',
  'Crash': 'bg-rose-100 text-rose-800',
};

export default function JournalPage() {
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummaries = useCallback(async () => {
    try {
      const res = await fetch('/api/daily-summary');
      if (res.ok) {
        const data = await res.json();
        setSummaries(Array.isArray(data) ? data : []);
      }
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSummaries(); }, [fetchSummaries]);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/trades/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: text }),
      });
      if (!res.ok) throw new Error(await res.text());
      const preview = await res.json();

      // Confirm import
      const confirmRes = await fetch('/api/trades/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: text, confirm: true, trades: preview.roundTrips }),
      });
      if (!confirmRes.ok) throw new Error(await confirmRes.text());
      await fetchSummaries();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-stone-900 tracking-tighter">Trade Journal</h1>
          <p className="text-stone-500 font-medium mt-1">Daily trading sessions with regime tracking and notes</p>
        </div>
        <label className="cursor-pointer">
          <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          <div className={cn(
            "text-xs font-semibold px-5 py-3 rounded-xl transition-all flex items-center gap-2 border",
            uploading ? "bg-stone-200 text-stone-500" : "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200"
          )}>
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Importing...' : 'Import Webull CSV'}
          </div>
        </label>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-800 px-6 py-4 rounded-2xl text-sm font-bold border border-rose-100">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card p-12 text-center"><div className="w-6 h-6 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto" /></div>
      ) : summaries.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-stone-400">No journal entries yet</h3>
          <p className="text-sm text-stone-400 mt-2">Import a Webull CSV to start logging trades, or entries will appear after using the dashboard CSV upload.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link href={`/journal/${s.date}`}>
                <div className="card p-5 hover:shadow-md transition-all group cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-sm font-black text-stone-900">
                          {format(new Date(s.date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {s.regime_predicted && (
                            <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold", REGIME_COLORS[s.regime_predicted] || 'bg-stone-100 text-stone-600')}>{s.regime_predicted}</span>
                          )}
                          <span className="text-xs text-stone-400">{s.trade_count} trades</span>
                          <span className="text-xs text-stone-400">W{s.win_count} L{s.loss_count}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={cn("text-lg font-black", s.total_pnl >= 0 ? "text-emerald-700" : "text-rose-700")}>
                          {s.total_pnl >= 0 ? '+' : ''}{currencyFmt.format(s.total_pnl)}
                        </div>
                        <div className="text-[10px] font-bold text-stone-400 uppercase">
                          {s.win_count > 0 && s.trade_count > 0 ? `${((s.win_count / s.trade_count) * 100).toFixed(0)}% win rate` : ''}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-500 transition-colors" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
