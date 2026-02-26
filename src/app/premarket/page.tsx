'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Crosshair, Send, Upload, AlertTriangle, TrendingUp, TrendingDown, Minus, Shield } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Regime, GexSign, DexTrend, VixTermStructure, TradeCall, AiPremarketResponse, AiScenario, BlindspotLevel } from '@/lib/types';
import { classifyRegime, getRegimeDescription } from '@/lib/regime-classifier';

const REGIME_COLORS: Record<Regime, string> = {
  'Pinning': 'bg-violet-100 text-violet-800 border-violet-200',
  'Grinding': 'bg-amber-100 text-amber-800 border-amber-200',
  'Breakout-Ready': 'bg-blue-100 text-blue-800 border-blue-200',
  'Crash': 'bg-rose-100 text-rose-800 border-rose-200',
};

const CALL_COLORS: Record<TradeCall, string> = {
  'Trade': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'No-Trade': 'bg-rose-100 text-rose-800 border-rose-200',
  'Cautious': 'bg-amber-100 text-amber-800 border-amber-200',
};

function ScenarioCard({ scenario, label }: { scenario: AiScenario; label: string }) {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-widest text-stone-400">{label}</span>
        <span className="text-xs font-bold text-stone-500">{scenario.weight}% weight</span>
      </div>
      <p className="text-sm text-stone-700">{scenario.description}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-stone-400 text-xs font-bold">Setup</span><div className="font-bold text-stone-900">{scenario.setup}</div></div>
        <div><span className="text-stone-400 text-xs font-bold">Direction</span><div className="font-bold text-stone-900">{scenario.direction}</div></div>
        <div><span className="text-stone-400 text-xs font-bold">Entry</span><div className="font-bold text-stone-900">${scenario.entryLevel}</div></div>
        <div><span className="text-stone-400 text-xs font-bold">Trigger</span><div className="font-bold text-stone-900">{scenario.entryTrigger}</div></div>
        <div><span className="text-stone-400 text-xs font-bold">Target</span><div className="font-bold text-emerald-700">${scenario.target}</div></div>
        <div><span className="text-stone-400 text-xs font-bold">Stop</span><div className="font-bold text-rose-700">${scenario.stop}</div></div>
      </div>
    </div>
  );
}

export default function PremarketPage() {
  const [qqqPrice, setQqqPrice] = useState('');
  const [vix, setVix] = useState('');
  const [vixTermStructure, setVixTermStructure] = useState<VixTermStructure>('contango');
  const [gexValue, setGexValue] = useState('');
  const [dexValue, setDexValue] = useState('');
  const [dexTrend, setDexTrend] = useState<DexTrend>('flat');
  const [callWall, setCallWall] = useState('');
  const [putWall, setPutWall] = useState('');
  const [gammaFlip, setGammaFlip] = useState('');
  const [volTrigger, setVolTrigger] = useState('');
  const [hvl, setHvl] = useState('');
  const [zeroGamma, setZeroGamma] = useState('');
  const [blindspots, setBlindspots] = useState<BlindspotLevel[]>([]);
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<AiPremarketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-classify regime
  const gexNum = parseFloat(gexValue);
  const qqqNum = parseFloat(qqqPrice);
  const vtNum = parseFloat(volTrigger);
  const canClassify = !isNaN(gexNum) && !isNaN(qqqNum) && !isNaN(vtNum);
  const gexSign: GexSign = gexNum >= 0 ? 'positive' : 'negative';
  const priceVsVt = qqqNum >= vtNum ? 'above' : 'below';
  const regime = canClassify ? classifyRegime(gexSign, priceVsVt as 'above' | 'below') : null;

  const handleScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'gex');
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.path) setScreenshot(data.path);
    } catch { }
  };

  const addBlindspot = () => setBlindspots([...blindspots, { level: 0, label: '' }]);
  const removeBlindspot = (i: number) => setBlindspots(blindspots.filter((_, idx) => idx !== i));

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const body = {
        date: today,
        qqqPrice: parseFloat(qqqPrice),
        vix: parseFloat(vix),
        vixTermStructure,
        gexValue: parseFloat(gexValue),
        dexValue: parseFloat(dexValue),
        dexTrend,
        callWall: parseFloat(callWall),
        putWall: parseFloat(putWall),
        gammaFlip: gammaFlip ? parseFloat(gammaFlip) : undefined,
        volTrigger: parseFloat(volTrigger),
        hvl: hvl ? parseFloat(hvl) : undefined,
        zeroGamma: zeroGamma ? parseFloat(zeroGamma) : undefined,
        blindspots: blindspots.filter(b => b.level > 0),
        notes,
        screenshotPath: screenshot,
      };
      const res = await fetch('/api/claude/analyze-premarket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRecommendation(data);
    } catch (err: any) {
      setError(err.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-900 focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all";
  const labelClass = "text-[10px] font-black uppercase tracking-[0.25em] text-stone-400 block mb-1.5";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-black text-stone-900 tracking-tighter">Pre-Market Analysis</h1>
        <p className="text-stone-500 font-medium mt-1">Enter GEX/DEX levels and get AI-powered trade recommendations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Inputs */}
        <div className="space-y-6">
          {/* Screenshot Upload */}
          <div className="card p-6">
            <h3 className="text-sm font-black text-stone-800 mb-4 flex items-center gap-2"><Upload className="w-4 h-4" /> GEX Screenshot</h3>
            <label className="block cursor-pointer">
              <input type="file" accept="image/*" onChange={handleScreenshot} className="hidden" />
              <div className={cn("border-2 border-dashed rounded-xl p-6 text-center transition-all", screenshot ? "border-emerald-300 bg-emerald-50/50" : "border-stone-200 hover:border-stone-400")}>
                {screenshot ? (
                  <div className="space-y-2">
                    <img src={screenshot} alt="GEX Screenshot" className="max-h-40 mx-auto rounded-lg" />
                    <p className="text-xs text-emerald-700 font-semibold">Screenshot uploaded</p>
                  </div>
                ) : (
                  <p className="text-sm text-stone-400 font-medium">Drop or click to upload GEX/DEX screenshot</p>
                )}
              </div>
            </label>
          </div>

          {/* Market Data */}
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-black text-stone-800 mb-2">Market Data</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>QQQ Price</label><input type="number" step="0.01" value={qqqPrice} onChange={e => setQqqPrice(e.target.value)} className={inputClass} placeholder="e.g. 520.50" /></div>
              <div><label className={labelClass}>VIX</label><input type="number" step="0.01" value={vix} onChange={e => setVix(e.target.value)} className={inputClass} placeholder="e.g. 18.5" /></div>
              <div><label className={labelClass}>VIX Term Structure</label>
                <select value={vixTermStructure} onChange={e => setVixTermStructure(e.target.value as VixTermStructure)} className={inputClass}>
                  <option value="contango">Contango (normal)</option>
                  <option value="backwardation">Backwardation (fear)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Dealer Positioning */}
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-black text-stone-800 mb-2">Dealer Positioning</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>GEX Value</label><input type="number" value={gexValue} onChange={e => setGexValue(e.target.value)} className={inputClass} placeholder="e.g. 500000000" /></div>
              <div><label className={labelClass}>DEX Value</label><input type="number" value={dexValue} onChange={e => setDexValue(e.target.value)} className={inputClass} placeholder="e.g. -200000000" /></div>
              <div><label className={labelClass}>DEX Trend</label>
                <select value={dexTrend} onChange={e => setDexTrend(e.target.value as DexTrend)} className={inputClass}>
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="flat">Flat</option>
                </select>
              </div>
            </div>
          </div>

          {/* Key Levels */}
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-black text-stone-800 mb-2">Key Levels</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>Call Wall</label><input type="number" step="0.01" value={callWall} onChange={e => setCallWall(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Put Wall</label><input type="number" step="0.01" value={putWall} onChange={e => setPutWall(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Gamma Flip</label><input type="number" step="0.01" value={gammaFlip} onChange={e => setGammaFlip(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Vol Trigger</label><input type="number" step="0.01" value={volTrigger} onChange={e => setVolTrigger(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>HVL</label><input type="number" step="0.01" value={hvl} onChange={e => setHvl(e.target.value)} className={inputClass} /></div>
              <div><label className={labelClass}>Zero Gamma</label><input type="number" step="0.01" value={zeroGamma} onChange={e => setZeroGamma(e.target.value)} className={inputClass} /></div>
            </div>
          </div>

          {/* Blindspots */}
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-800">Blindspot Levels</h3>
              <button onClick={addBlindspot} className="text-xs font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg transition-all">+ Add</button>
            </div>
            {blindspots.map((b, i) => (
              <div key={i} className="flex gap-3 items-center">
                <input type="text" placeholder="Label" value={b.label} onChange={e => { const u = [...blindspots]; u[i] = { ...u[i], label: e.target.value }; setBlindspots(u); }} className={cn(inputClass, "flex-1")} />
                <input type="number" step="0.01" placeholder="Level" value={b.level || ''} onChange={e => { const u = [...blindspots]; u[i] = { ...u[i], level: parseFloat(e.target.value) || 0 }; setBlindspots(u); }} className={cn(inputClass, "w-32")} />
                <button onClick={() => removeBlindspot(i)} className="text-stone-400 hover:text-rose-500 transition-colors">×</button>
              </div>
            ))}
          </div>

          {/* Regime Classification */}
          {regime && (
            <div className="card p-6">
              <h3 className="text-sm font-black text-stone-800 mb-3">Auto-Classified Regime</h3>
              <div className="flex items-center gap-3">
                <span className={cn("px-4 py-2 rounded-xl text-sm font-bold border", REGIME_COLORS[regime])}>{regime}</span>
              </div>
              <p className="text-xs text-stone-500 mt-2">{getRegimeDescription(regime)}</p>
            </div>
          )}

          {/* Notes */}
          <div className="card p-6">
            <label className={labelClass}>Notes / Context</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={cn(inputClass, "min-h-[80px] resize-y")} placeholder="Any additional context (FOMC, earnings, overnight gaps...)" />
          </div>

          {/* Analyze Button */}
          <button
            onClick={handleAnalyze}
            disabled={loading || !qqqPrice || !vix || !gexValue || !callWall || !putWall || !volTrigger}
            className={cn(
              "w-full py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3",
              loading ? "bg-stone-300 text-stone-500 cursor-wait" : "bg-stone-900 text-white hover:bg-stone-800 shadow-lg shadow-stone-200 active:scale-[0.98]"
            )}
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-stone-500 border-t-transparent rounded-full animate-spin" /> Analyzing...</>
            ) : (
              <><Send className="w-4 h-4" /> Get AI Recommendation</>
            )}
          </button>
        </div>

        {/* Right: AI Recommendation */}
        <div className="space-y-6">
          {error && (
            <div className="card p-6 border-rose-200 bg-rose-50">
              <div className="flex items-center gap-2 text-rose-800"><AlertTriangle className="w-4 h-4" /><span className="text-sm font-bold">{error}</span></div>
            </div>
          )}

          {!recommendation && !error && (
            <div className="card p-12 text-center">
              <Crosshair className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-stone-400">Enter your levels and analyze</h3>
              <p className="text-sm text-stone-400 mt-2">Claude will classify the regime and generate a game plan with specific setups, entries, targets, and stops.</p>
            </div>
          )}

          {recommendation && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Trade Call */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-stone-800">Trade Call</h3>
                  <span className={cn("px-4 py-2 rounded-xl text-sm font-black border", CALL_COLORS[recommendation.tradeCall])}>{recommendation.tradeCall}</span>
                </div>
                <p className="text-sm text-stone-700">{recommendation.tradeCallReasoning}</p>
                <div className="flex items-center gap-3 mt-4">
                  <span className={cn("px-3 py-1.5 rounded-lg text-xs font-bold border", REGIME_COLORS[recommendation.regime])}>{recommendation.regime}</span>
                  <span className="text-xs text-stone-500">Confidence: <strong>{recommendation.regimeConfidence}</strong></span>
                </div>
                {recommendation.regimeNuance && <p className="text-xs text-stone-500 mt-2 italic">{recommendation.regimeNuance}</p>}
              </div>

              {/* Scenarios */}
              <ScenarioCard scenario={recommendation.primaryScenario} label="Primary Scenario" />
              {recommendation.alternativeScenario && (
                <ScenarioCard scenario={recommendation.alternativeScenario} label="Alternative Scenario" />
              )}

              {/* Levels to Watch */}
              <div className="card p-6">
                <h3 className="text-sm font-black text-stone-800 mb-4">Levels to Watch</h3>
                <div className="space-y-3">
                  {recommendation.levelsToWatch.bullishAbove && (
                    <div className="flex items-center gap-3">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm"><strong className="text-emerald-700">${recommendation.levelsToWatch.bullishAbove.level}</strong> — {recommendation.levelsToWatch.bullishAbove.reason}</span>
                    </div>
                  )}
                  {recommendation.levelsToWatch.bearishBelow && (
                    <div className="flex items-center gap-3">
                      <TrendingDown className="w-4 h-4 text-rose-600" />
                      <span className="text-sm"><strong className="text-rose-700">${recommendation.levelsToWatch.bearishBelow.level}</strong> — {recommendation.levelsToWatch.bearishBelow.reason}</span>
                    </div>
                  )}
                  {recommendation.levelsToWatch.pinTarget && (
                    <div className="flex items-center gap-3">
                      <Minus className="w-4 h-4 text-violet-600" />
                      <span className="text-sm"><strong className="text-violet-700">${recommendation.levelsToWatch.pinTarget.level}</strong> — {recommendation.levelsToWatch.pinTarget.reason}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Risk Notes */}
              {recommendation.riskNotes.length > 0 && (
                <div className="card p-6 border-amber-200 bg-amber-50/50">
                  <h3 className="text-sm font-black text-amber-800 mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Risk Notes</h3>
                  <ul className="space-y-2">
                    {recommendation.riskNotes.map((note, i) => (
                      <li key={i} className="text-sm text-amber-800 flex items-start gap-2">
                        <span className="text-amber-400 mt-0.5">•</span>{note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {recommendation.historicalComparison && (
                <div className="card p-6">
                  <h3 className="text-sm font-black text-stone-800 mb-3">Historical Comparison</h3>
                  <p className="text-sm text-stone-700">{recommendation.historicalComparison}</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
