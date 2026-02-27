'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, Save, ChevronDown, ChevronUp, ImagePlus, X, Check } from 'lucide-react';
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
  chart_screenshot_path: string | null;
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const [dayPnl, setDayPnl] = useState<number>(0);
  const [predictedRegime, setPredictedRegime] = useState<string | null>(null);
  const targetTradeRef = useRef<HTMLDivElement>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

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

        if (targetSymbol) {
          const match = tradesList.find(t => t.symbol === targetSymbol);
          if (match) setExpandedId(match.id);
        }
      }
      if (summaryRes.ok) {
        const s = await summaryRes.json();
        if (s) {
          setDayPnl(s.total_pnl ?? 0);
          setPredictedRegime(s.regime_predicted);
        }
      }
    } catch { }
    setLoading(false);
  }, [dateStr, targetSymbol]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (expandedId && targetSymbol && targetTradeRef.current) {
      targetTradeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [expandedId, targetSymbol, loading]);

  const saveTrade = async (trade: DbTrade) => {
    setSaving(prev => ({ ...prev, [trade.id]: true }));
    setSaved(prev => ({ ...prev, [trade.id]: false }));
    try {
      await fetch(`/api/trades/${trade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setup_type: trade.setup_type,
          regime: trade.regime,
          profit_mode: trade.profit_mode,
          thesis: trade.thesis,
          what_went_right: trade.what_went_right,
          what_went_wrong: trade.what_went_wrong,
          key_learning: trade.key_learning,
          chart_screenshot_path: trade.chart_screenshot_path,
        }),
      });
      setSaved(prev => ({ ...prev, [trade.id]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [trade.id]: false })), 2000);
    } catch { }
    setSaving(prev => ({ ...prev, [trade.id]: false }));
  };

  const updateLocalTrade = (id: number, field: string, value: string | null) => {
    setTrades(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleScreenshot = async (tradeId: number, file: File) => {
    setUploading(prev => ({ ...prev, [tradeId]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'chart');
      formData.append('date', dateStr);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const json = await res.json();
        const path = json.data?.path;
        if (path) {
          updateLocalTrade(tradeId, 'chart_screenshot_path', path);
          // Also persist immediately
          await fetch(`/api/trades/${tradeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chart_screenshot_path: path }),
          });
        }
      }
    } catch { }
    setUploading(prev => ({ ...prev, [tradeId]: false }));
  };

  const handlePaste = (tradeId: number, e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleScreenshot(tradeId, file);
        return;
      }
    }
  };

  const removeScreenshot = async (tradeId: number) => {
    updateLocalTrade(tradeId, 'chart_screenshot_path', null);
    await fetch(`/api/trades/${tradeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chart_screenshot_path: null }),
    });
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
            {predictedRegime && (
              <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold", REGIME_COLORS[predictedRegime] || 'bg-stone-100 text-stone-600')}>
                Predicted: {predictedRegime}
              </span>
            )}
            {dayPnl !== 0 && (
              <span className={cn("text-lg font-black", dayPnl >= 0 ? "text-emerald-700" : "text-rose-700")}>
                {dayPnl >= 0 ? '+' : ''}{currencyFmt.format(dayPnl)}
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
                    <div className="text-xs text-stone-400">{trade.qty} contract{trade.qty > 1 ? 's' : ''} · {trade.holding_minutes != null ? `${Math.round(trade.holding_minutes)}min` : '?'}</div>
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
                <div className="border-t border-stone-100 p-5 bg-stone-50/30 space-y-4" onPaste={e => handlePaste(trade.id, e)}>
                  {/* Chart Screenshot */}
                  <div>
                    <label className={labelClass}>Chart Screenshot</label>
                    {trade.chart_screenshot_path ? (
                      <div className="relative group">
                        <img
                          src={trade.chart_screenshot_path}
                          alt="Trade chart"
                          className="w-full max-h-[400px] object-contain rounded-xl border border-stone-200 bg-white"
                        />
                        <button
                          onClick={() => removeScreenshot(trade.id)}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-stone-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRefs.current[trade.id]?.click()}
                        className={cn(
                          "border-2 border-dashed border-stone-200 rounded-xl p-8 text-center cursor-pointer hover:border-stone-400 hover:bg-white transition-all",
                          uploading[trade.id] && "opacity-50 pointer-events-none"
                        )}
                      >
                        <input
                          ref={el => { fileInputRefs.current[trade.id] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleScreenshot(trade.id, file);
                            e.target.value = '';
                          }}
                        />
                        {uploading[trade.id] ? (
                          <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin mx-auto" />
                        ) : (
                          <>
                            <ImagePlus className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-stone-400">Click to upload or paste (Ctrl+V) a chart screenshot</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

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
                      <select value={trade.setup_type || ''} onChange={e => updateLocalTrade(trade.id, 'setup_type', e.target.value || null)} className={inputClass}>
                        <option value="">Select setup...</option>
                        {SETUPS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Regime</label>
                      <select value={trade.regime || ''} onChange={e => updateLocalTrade(trade.id, 'regime', e.target.value || null)} className={inputClass}>
                        <option value="">Select regime...</option>
                        {REGIMES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Profit Mode</label>
                      <select value={trade.profit_mode || ''} onChange={e => updateLocalTrade(trade.id, 'profit_mode', e.target.value || null)} className={inputClass}>
                        <option value="">Select mode...</option>
                        {PROFIT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Thesis at Entry</label>
                    <textarea value={trade.thesis || ''} onChange={e => updateLocalTrade(trade.id, 'thesis', e.target.value)} className={cn(inputClass, "min-h-[60px] resize-y")} placeholder="What was your thesis for this trade?" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>What Went Right</label>
                      <textarea value={trade.what_went_right || ''} onChange={e => updateLocalTrade(trade.id, 'what_went_right', e.target.value)} className={cn(inputClass, "min-h-[60px] resize-y")} />
                    </div>
                    <div>
                      <label className={labelClass}>What Went Wrong</label>
                      <textarea value={trade.what_went_wrong || ''} onChange={e => updateLocalTrade(trade.id, 'what_went_wrong', e.target.value)} className={cn(inputClass, "min-h-[60px] resize-y")} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Key Learning</label>
                    <textarea value={trade.key_learning || ''} onChange={e => updateLocalTrade(trade.id, 'key_learning', e.target.value)} className={cn(inputClass, "min-h-[60px] resize-y")} placeholder="What's the one takeaway from this trade?" />
                  </div>

                  {/* Save Button */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => saveTrade(trade)}
                      disabled={saving[trade.id]}
                      className={cn(
                        "flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg",
                        saving[trade.id]
                          ? "bg-stone-300 text-stone-500 cursor-wait"
                          : saved[trade.id]
                            ? "bg-emerald-600 text-white shadow-emerald-200"
                            : "bg-stone-900 text-white hover:bg-stone-800 shadow-stone-200 active:scale-95"
                      )}
                    >
                      {saving[trade.id] ? (
                        <><div className="w-4 h-4 border-2 border-stone-400 border-t-white rounded-full animate-spin" /> Saving...</>
                      ) : saved[trade.id] ? (
                        <><Check className="w-4 h-4" /> Saved</>
                      ) : (
                        <><Save className="w-4 h-4" /> Save Journal Entry</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
