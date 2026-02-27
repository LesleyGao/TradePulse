'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Save, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import type { Regime, ProfitMode, RuleViolation } from '@/lib/types';

interface DbTrade {
  id: number;
  date: string;
  symbol: string;
  underlying: string;
  strike: number;
  call_put: string;
  side: string;
  qty: number;
  entry_price: number;
  exit_price: number | null;
  pnl_dollar: number | null;
  pnl_percent: number | null;
  holding_minutes: number | null;
  setup_type: string | null;
  regime: string | null;
  profit_mode: string | null;
  thesis: string | null;
  what_went_right: string | null;
  what_went_wrong: string | null;
  key_learning: string | null;
  entry_time: string;
  exit_time: string | null;
  rule_violations: string | null;
}

interface DailySummary {
  id: number;
  date: string;
  total_pnl: number;
  trade_count: number;
  win_count: number;
  loss_count: number;
  regime_predicted: string | null;
  regime_actual: string | null;
  regime_accuracy_note: string | null;
  adjustment_for_tomorrow: string | null;
  user_notes: string | null;
}

const SETUPS = ['Kiss n Go', 'Breakout / Breakdown', 'Open Space'];
const REGIMES: Regime[] = ['Pinning', 'Grinding', 'Breakout-Ready', 'Crash'];
const PROFIT_MODES: ProfitMode[] = ['Quick Take', 'Runner'];
const REGIME_COLORS: Record<string, string> = {
  'Pinning': 'bg-violet-100 text-violet-800',
  'Grinding': 'bg-amber-100 text-amber-800',
  'Breakout-Ready': 'bg-blue-100 text-blue-800',
  'Crash': 'bg-rose-100 text-rose-800',
};
const VIOLATION_COLORS: Record<string, string> = {
  'violation': 'bg-rose-50 border-rose-200 text-rose-700',
  'warning': 'bg-amber-50 border-amber-200 text-amber-700',
};

export default function JournalDatePage() {
  const params = useParams() as { date: string };
  const searchParams = useSearchParams();
  const dateStr = params.date;
  const targetSymbol = searchParams.get('symbol');

  const [trades, setTrades] = useState<DbTrade[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const targetTradeRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [tradesRes, summaryRes] = await Promise.all([
        fetch(`/api/trades?date=${dateStr}`),
        fetch(`/api/daily-summary/${dateStr}`),
      ]);
      if (tradesRes.ok) {
        const json = await tradesRes.json();
        const tradesList: DbTrade[] = json.data ?? json;
        setTrades(tradesList);

        // Auto-expand trade matching the symbol query param
        if (targetSymbol) {
          const match = tradesList.find(t => t.symbol === targetSymbol);
          if (match) setExpandedId(match.id);
        }
      }
      if (summaryRes.ok) setSummary(await summaryRes.json());
    } catch { }
    setLoading(false);
  }, [dateStr, targetSymbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Scroll to the target trade once it's expanded and rendered
  useEffect(() => {
    if (expandedId && targetSymbol && targetTradeRef.current) {
      targetTradeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [expandedId, targetSymbol, loading]);

  const updateTrade = async (id: number, updates: Record<string, string | null>) => {
    setSaving(prev => ({ ...prev, [id]: true }));
    try {
      await fetch(`/api/trades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setTrades(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    } catch { }
    setSaving(prev => ({ ...prev, [id]: false }));
  };

  const updateSummary = async (updates: Record<string, string | null>) => {
    if (!summary) return;
    try {
      await fetch(`/api/daily-summary/${dateStr}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      setSummary(prev => prev ? { ...prev, ...updates } : prev);
    } catch { }
  };

  const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const labelClass = "text-[10px] font-black uppercase tracking-[0.25em] text-stone-400 block mb-1.5";
  const inputClass = "w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-900 focus:ring-2 focus:ring-stone-400 transition-all";

  if (loading) return <div className="card p-12 text-center"><div className="w-6 h-6 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/journal" className="p-2 rounded-xl hover:bg-stone-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-stone-500" />
        </Link>
        <div>
          <h1 className="text-3xl font-black text-stone-900 tracking-tighter">
            {format(new Date(dateStr + 'T12:00:00'), 'EEEE, MMMM d, yyyy')}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            {summary?.regime_predicted && (
              <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold", REGIME_COLORS[summary.regime_predicted] || 'bg-stone-100 text-stone-600')}>
                Predicted: {summary.regime_predicted}
              </span>
            )}
            {summary && (
              <span className={cn("text-lg font-black", summary.total_pnl >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {summary.total_pnl >= 0 ? '+' : ''}{currencyFmt.format(summary.total_pnl)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trade List */}
      <div className="space-y-3">
        <h2 className="text-sm font-black text-stone-800 uppercase tracking-widest">Trades ({trades.length})</h2>
        {trades.map(trade => {
          const isExpanded = expandedId === trade.id;
          const pnl = trade.pnl_dollar ?? 0;
          const isTarget = trade.symbol === targetSymbol;
          return (
            <div key={trade.id} ref={isTarget ? targetTradeRef : undefined} className="card overflow-hidden">
              <button onClick={() => setExpandedId(isExpanded ? null : trade.id)} className="w-full p-5 flex items-center justify-between hover:bg-stone-50/50 transition-colors">
                <div className="flex items-center gap-4">
                  <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold", trade.call_put === 'C' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                    {trade.call_put === 'C' ? 'CALL' : 'PUT'}
                  </span>
                  <div className="text-left">
                    <div className="text-sm font-bold text-stone-900">{trade.underlying} ${trade.strike}</div>
                    <div className="text-xs text-stone-400">{trade.qty} contract{trade.qty > 1 ? 's' : ''} · {trade.holding_minutes ?? '?'}min</div>
                  </div>
                  {trade.setup_type && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-600">{trade.setup_type}</span>
                  )}
                  {trade.profit_mode && (
                    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold", trade.profit_mode === 'Runner' ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-stone-500')}>{trade.profit_mode}</span>
                  )}
                  {trade.rule_violations && JSON.parse(trade.rule_violations).length > 0 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-600">
                      {JSON.parse(trade.rule_violations).filter((v: RuleViolation) => v.severity === 'violation').length > 0 ? 'VIOLATION' : 'WARNING'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={cn("text-sm font-black", pnl >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {pnl >= 0 ? '+' : ''}{currencyFmt.format(pnl)}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      ${trade.entry_price} → ${trade.exit_price ?? '?'}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-stone-100 p-5 bg-stone-50/30 space-y-4">
                  {/* Rule Violations */}
                  {(() => {
                    const violations: RuleViolation[] = trade.rule_violations ? JSON.parse(trade.rule_violations) : [];
                    if (violations.length === 0) return null;
                    return (
                      <div className="space-y-1.5">
                        <label className={labelClass}>Rule Violations</label>
                        {violations.map((v, i) => (
                          <div key={i} className={cn("border rounded-lg px-3 py-2 text-xs font-semibold", VIOLATION_COLORS[v.severity] || VIOLATION_COLORS.warning)}>
                            <span className="uppercase tracking-wider text-[9px] opacity-70">{v.severity}</span> {v.message}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Setup Type</label>
                      <select value={trade.setup_type || ''} onChange={e => updateTrade(trade.id, { setup_type: e.target.value || null })} className={inputClass}>
                        <option value="">Select setup...</option>
                        {SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Regime</label>
                      <select value={trade.regime || ''} onChange={e => updateTrade(trade.id, { regime: e.target.value || null })} className={inputClass}>
                        <option value="">Select regime...</option>
                        {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Profit Mode</label>
                      <select value={trade.profit_mode || ''} onChange={e => updateTrade(trade.id, { profit_mode: e.target.value || null })} className={inputClass}>
                        <option value="">Select mode...</option>
                        {PROFIT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Thesis at Entry</label>
                    <textarea value={trade.thesis || ''} onChange={e => setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, thesis: e.target.value } : t))} onBlur={e => updateTrade(trade.id, { thesis: e.target.value || null })} className={cn(inputClass, "min-h-[60px] resize-y")} placeholder="What was your thesis for this trade?" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>What Went Right</label>
                      <textarea value={trade.what_went_right || ''} onChange={e => setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, what_went_right: e.target.value } : t))} onBlur={e => updateTrade(trade.id, { what_went_right: e.target.value || null })} className={cn(inputClass, "min-h-[60px] resize-y")} />
                    </div>
                    <div>
                      <label className={labelClass}>What Went Wrong</label>
                      <textarea value={trade.what_went_wrong || ''} onChange={e => setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, what_went_wrong: e.target.value } : t))} onBlur={e => updateTrade(trade.id, { what_went_wrong: e.target.value || null })} className={cn(inputClass, "min-h-[60px] resize-y")} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Key Learning</label>
                    <textarea value={trade.key_learning || ''} onChange={e => setTrades(prev => prev.map(t => t.id === trade.id ? { ...t, key_learning: e.target.value } : t))} onBlur={e => updateTrade(trade.id, { key_learning: e.target.value || null })} className={cn(inputClass, "min-h-[60px] resize-y")} placeholder="What's the one takeaway from this trade?" />
                  </div>
                  {saving[trade.id] && <div className="text-xs text-stone-400 flex items-center gap-2"><div className="w-3 h-3 border border-stone-300 border-t-stone-600 rounded-full animate-spin" /> Saving...</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Daily Notes */}
      {summary && (
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-black text-stone-800 uppercase tracking-widest">Daily Notes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Actual Regime</label>
              <select value={summary.regime_actual || ''} onChange={e => updateSummary({ regime_actual: e.target.value || null })} className={inputClass}>
                <option value="">Select...</option>
                {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Regime Accuracy Note</label>
              <input type="text" value={summary.regime_accuracy_note || ''} onChange={e => setSummary(prev => prev ? { ...prev, regime_accuracy_note: e.target.value } : prev)} onBlur={e => updateSummary({ regime_accuracy_note: e.target.value || null })} className={inputClass} placeholder="How accurate was the prediction?" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Adjustment for Tomorrow</label>
            <textarea value={summary.adjustment_for_tomorrow || ''} onChange={e => setSummary(prev => prev ? { ...prev, adjustment_for_tomorrow: e.target.value } : prev)} onBlur={e => updateSummary({ adjustment_for_tomorrow: e.target.value || null })} className={cn(inputClass, "min-h-[60px] resize-y")} placeholder="What will you change tomorrow based on today?" />
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={summary.user_notes || ''} onChange={e => setSummary(prev => prev ? { ...prev, user_notes: e.target.value } : prev)} onBlur={e => updateSummary({ user_notes: e.target.value || null })} className={cn(inputClass, "min-h-[80px] resize-y")} placeholder="General thoughts on today's session..." />
          </div>
        </div>
      )}
    </div>
  );
}
