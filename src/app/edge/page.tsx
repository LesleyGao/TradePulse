'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Zap, ChevronDown, ChevronUp, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface EdgeRefinement {
  id: number;
  trade_count: number;
  analysis_date: string;
  trigger_type: string;
  findings: string;
  setup_recommendations: string | null;
  strongest_edges: string | null;
  weakest_edges: string | null;
  concrete_change: string | null;
}

interface EdgeDimension {
  setup?: string;
  regime?: string;
  window?: string;
  trades: number;
  wins: number;
  winRate: number;
  expectancy: number;
  note?: string;
}

export default function EdgePage() {
  const [refinements, setRefinements] = useState<EdgeRefinement[]>([]);
  const [tradeCount, setTradeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [edgeRes, statsRes] = await Promise.all([
        fetch('/api/edge-refinement'),
        fetch('/api/stats'),
      ]);
      if (edgeRes.ok) {
        const data = await edgeRes.json();
        setRefinements(Array.isArray(data) ? data : []);
        if (data.length > 0) setExpandedId(data[0].id);
      }
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setTradeCount(stats.overall?.totalTrades ?? 0);
      }
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/claude/edge-analysis', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const nextMilestone = Math.ceil(tradeCount / 20) * 20;
  const progress = tradeCount > 0 ? ((tradeCount % 20) / 20) * 100 : 0;

  const parseSafe = (json: string | null): any => {
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
  };

  if (loading) return <div className="card p-12 text-center"><div className="w-6 h-6 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black text-stone-900 tracking-tighter">Edge Refinement</h1>
        <p className="text-stone-500 font-medium mt-1">AI-powered analysis of your trading patterns and performance</p>
      </div>

      {/* Progress */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-black text-stone-800">{tradeCount} trades logged</div>
            <div className="text-xs text-stone-400">Next milestone at {nextMilestone} trades ({nextMilestone - tradeCount} to go)</div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={analyzing || tradeCount < 5}
            className={cn(
              "text-xs font-semibold px-5 py-3 rounded-xl transition-all flex items-center gap-2",
              analyzing ? "bg-stone-200 text-stone-500" : tradeCount < 5 ? "bg-stone-100 text-stone-400 cursor-not-allowed" : "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200"
            )}
          >
            {analyzing ? (
              <><div className="w-3.5 h-3.5 border-2 border-stone-400 border-t-transparent rounded-full animate-spin" /> Analyzing...</>
            ) : (
              <><Zap className="w-3.5 h-3.5" /> Run Edge Analysis</>
            )}
          </button>
        </div>
        <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full bg-stone-900 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error && (
        <div className="card p-6 border-rose-200 bg-rose-50 text-sm font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Refinement History */}
      {refinements.length === 0 ? (
        <div className="card p-12 text-center">
          <Zap className="w-12 h-12 text-stone-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-stone-400">No edge analysis yet</h3>
          <p className="text-sm text-stone-400 mt-2">Log at least 5 trades, then run an edge analysis to identify patterns.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {refinements.map(r => {
            const isExpanded = expandedId === r.id;
            const findings = parseSafe(r.findings);
            const strongest = parseSafe(r.strongest_edges) as EdgeDimension[] | null;
            const weakest = parseSafe(r.weakest_edges) as EdgeDimension[] | null;
            const recommendations = parseSafe(r.setup_recommendations);

            return (
              <div key={r.id} className="card overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : r.id)} className="w-full p-5 flex items-center justify-between hover:bg-stone-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <div className="text-left">
                      <div className="text-sm font-black text-stone-900">{r.analysis_date} — {r.trade_count} trades</div>
                      <div className="text-xs text-stone-400 capitalize">{r.trigger_type} analysis</div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-stone-100 p-5 space-y-6">
                    {/* Summary */}
                    {findings?.summary && (
                      <div><h4 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-2">Summary</h4><p className="text-sm text-stone-700">{findings.summary}</p></div>
                    )}

                    {/* Concrete Change */}
                    {r.concrete_change && (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                        <h4 className="text-xs font-black uppercase tracking-widest text-amber-600 mb-2">One Change for Tomorrow</h4>
                        <p className="text-sm font-bold text-amber-900">{r.concrete_change}</p>
                      </div>
                    )}

                    {/* Strongest Edges */}
                    {strongest && strongest.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-3 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" /> Strongest Edges</h4>
                        <div className="space-y-2">
                          {strongest.map((e, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
                              <div>
                                <span className="text-sm font-bold text-stone-900">{e.setup || e.regime}</span>
                                {e.note && <span className="text-xs text-stone-500 ml-2">{e.note}</span>}
                              </div>
                              <span className="text-sm font-black text-emerald-700">${e.expectancy?.toFixed(2)} exp</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Weakest Edges */}
                    {weakest && weakest.length > 0 && (
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-rose-600 mb-3 flex items-center gap-2"><TrendingDown className="w-3.5 h-3.5" /> Weakest Edges</h4>
                        <div className="space-y-2">
                          {weakest.map((e, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                              <div>
                                <span className="text-sm font-bold text-stone-900">{e.setup || e.regime}</span>
                                {e.note && <span className="text-xs text-stone-500 ml-2">{e.note}</span>}
                              </div>
                              <span className="text-sm font-black text-rose-700">${e.expectancy?.toFixed(2)} exp</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommendations */}
                    {recommendations && Array.isArray(recommendations) && (
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-3">Setup Recommendations</h4>
                        <div className="space-y-2">
                          {recommendations.map((rec: any, i: number) => (
                            <div key={i} className="p-3 rounded-xl bg-stone-50 border border-stone-100">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-stone-900">{rec.setup}</span>
                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold",
                                  rec.action === 'increase' ? 'bg-emerald-100 text-emerald-700' :
                                  rec.action === 'stop' ? 'bg-rose-100 text-rose-700' :
                                  rec.action === 'decrease' ? 'bg-amber-100 text-amber-700' :
                                  'bg-stone-100 text-stone-600'
                                )}>{rec.action}</span>
                              </div>
                              <p className="text-xs text-stone-500">{rec.reasoning}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
