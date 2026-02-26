'use client';
/**
 * Position size calculator: same risk (delta exposure) every day Mon–Fri
 * for Friday-expiring options. One input: Monday $; five deltas (Mon–Fri).
 * Day N $ = Monday $ × (Monday delta ÷ Day N delta). No premium.
 */

import React, { useState, useMemo } from 'react';
import { Calculator, Info, Calendar, RotateCcw, Target, Shield } from 'lucide-react';
import { cn } from '@/utils/cn';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

function roundToFifty(n: number): number {
  return Math.round(n / 50) * 50;
}

function formatExact(n: number): string {
  return n % 1 === 0
    ? n.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Typical 1–2 strikes OTM weekly (Fri expiry): lower delta Mon, ramps as DTE shrinks
const DEFAULT_DELTAS: Record<(typeof DAYS)[number], string> = {
  Monday: '0.38',
  Tuesday: '0.45',
  Wednesday: '0.52',
  Thursday: '0.65',
  Friday: '0.80',
};

const DEFAULT_THETAS: Record<(typeof DAYS)[number], string> = {
  Monday: '-0.08',
  Tuesday: '-0.12',
  Wednesday: '-0.18',
  Thursday: '-0.28',
  Friday: '-0.50',
};

export default function PositionSizeCalculator() {
  const [mondayDollars, setMondayDollars] = useState<string>('1500');
  const [deltas, setDeltas] = useState<Record<(typeof DAYS)[number], string>>(
    () => ({ ...DEFAULT_DELTAS })
  );
  const [thetas, setThetas] = useState<Record<(typeof DAYS)[number], string>>(
    () => ({ ...DEFAULT_THETAS })
  );
  const [useTheta, setUseTheta] = useState<boolean>(false);

  const parse = (s: string) => (s === '' || s === '-' ? NaN : parseFloat(s));

  const results = useMemo(() => {
    const monD = parse(mondayDollars);
    const monDelta = parse(deltas.Monday);
    if (Number.isNaN(monD) || monD <= 0 || Number.isNaN(monDelta) || monDelta <= 0 || monDelta > 1)
      return null;

    const dayAmounts: Record<(typeof DAYS)[number], number> = {} as Record<
      (typeof DAYS)[number],
      number
    >;
    dayAmounts.Monday = monD;
    for (let i = 1; i < DAYS.length; i++) {
      const day = DAYS[i];
      const d = parse(deltas[day]);
      if (Number.isNaN(d) || d <= 0 || d > 1) return null;
      dayAmounts[day] = monD * (monDelta / d);
    }

    let thetaAmounts: Record<(typeof DAYS)[number], number> | null = null;
    if (useTheta) {
      const monTheta = parse(thetas.Monday);
      if (!Number.isNaN(monTheta) && monTheta !== 0) {
        const absMon = Math.abs(monTheta);
        thetaAmounts = {} as Record<(typeof DAYS)[number], number>;
        thetaAmounts.Monday = monD;
        let valid = true;
        for (let i = 1; i < DAYS.length; i++) {
          const day = DAYS[i];
          const t = parse(thetas[day]);
          if (Number.isNaN(t) || t === 0) {
            valid = false;
            break;
          }
          thetaAmounts[day] = monD * (absMon / Math.abs(t));
        }
        if (!valid) thetaAmounts = null;
      }
    }

    return { dayAmounts, mondayDelta: monDelta, thetaAmounts };
  }, [mondayDollars, deltas, thetas, useTheta]);

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
            <Target className="w-3 h-3" />
            Risk Management
          </div>
          <h1 className="text-4xl font-black text-stone-900 tracking-tighter">Sizing Calculator</h1>
          <p className="text-stone-500 font-medium">Equate your daily delta exposure for weekly expirations.</p>
        </div>

        <button
          type="button"
          onClick={() => {
            setDeltas({ ...DEFAULT_DELTAS });
            setThetas({ ...DEFAULT_THETAS });
          }}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-stone-200 rounded-2xl text-xs font-bold text-stone-600 hover:text-stone-900 hover:border-stone-400 transition-all shadow-sm"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Parameters
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-1 space-y-8">
          <div className="card shadow-xl shadow-stone-200/40">
            <div className="p-6 border-b border-stone-100 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-stone-900 shrink-0">
                <Calculator className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-stone-900">Capital Inputs</h2>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">
                  Monday Baseline Position ($)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={mondayDollars}
                    onChange={(e) => setMondayDollars(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-full rounded-2xl border border-stone-200 bg-stone-50/50 pl-8 pr-4 py-4 text-stone-900 font-black placeholder-stone-300 focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none transition-all shadow-inner"
                    placeholder="1500"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-stone-100">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={cn(
                    "w-10 h-6 rounded-full transition-all duration-300 relative flex items-center px-1",
                    useTheta ? "bg-stone-900" : "bg-stone-200"
                  )}>
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300",
                      useTheta ? "translate-x-4" : "translate-x-0"
                    )} />
                    <input
                      type="checkbox"
                      checked={useTheta}
                      onChange={(e) => setUseTheta(e.target.checked)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <span className="text-xs font-bold text-stone-600 group-hover:text-stone-900">Include Theta Decay Risk</span>
                </label>
              </div>
            </div>
          </div>

          <div className="card bg-stone-900 text-white p-6 shadow-2xl shadow-stone-200">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-xl bg-stone-800">
                <Shield className="w-5 h-5 text-stone-400" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Delta Formula</h3>
                <p className="text-xs text-stone-400 mt-2 font-medium leading-relaxed">
                  To maintain constant share-equivalent exposure, we scale the position size by the relative change in delta.
                </p>
                <div className="mt-4 p-3 rounded-xl bg-stone-800 font-mono text-[10px] text-white overflow-x-auto whitespace-nowrap">
                  Size(N) = Size(Mon) × (ΔMon ÷ ΔN)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Greeks & Results */}
        <div className="lg:col-span-2 space-y-8">
          <div className="card shadow-xl shadow-stone-200/40 overflow-hidden">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50">
                  <Target className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-widest text-stone-900">Daily Delta Input</h2>
              </div>
              <div className="p-2 px-4 rounded-full bg-amber-50 border border-amber-100 text-[10px] font-black text-amber-700 uppercase tracking-widest">
                Real-time Calculation
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                {DAYS.map((day, i) => (
                  <div key={day} className="space-y-3">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] block text-center">
                      {DAY_SHORT[i]}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={deltas[day]}
                      onChange={(e) => setDeltas(prev => ({ ...prev, [day]: e.target.value.replace(/[^0-9.]/g, '') }))}
                      className="w-full rounded-2xl border border-stone-200 bg-stone-50/50 px-4 py-4 text-center text-sm font-black text-stone-900 focus:ring-2 focus:ring-stone-900 outline-none transition-all"
                    />
                    {useTheta && (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={thetas[day]}
                        onChange={(e) => setThetas(prev => ({ ...prev, [day]: e.target.value.replace(/[^0-9.-]/g, '') }))}
                        className="w-full rounded-xl border border-stone-100 bg-white px-2 py-2 text-center text-[10px] font-bold text-stone-500 focus:ring-2 focus:ring-stone-400 outline-none transition-all"
                        placeholder="θ"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-stone-50 border-t border-stone-100">
              <div className="flex items-center gap-2 text-stone-400 mb-6">
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap">Calculated Risk Allocation</span>
                <div className="h-px flex-1 bg-stone-200" />
              </div>

              {results ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {DAYS.map((day, i) => {
                    const exact = results.dayAmounts[day];
                    const round = roundToFifty(exact);
                    const isMon = day === 'Monday';
                    return (
                      <div
                        key={day}
                        className={cn(
                          'rounded-[2rem] p-6 text-center transition-all duration-300 group',
                          isMon
                            ? 'bg-stone-900 text-white shadow-2xl scale-105 z-10'
                            : 'bg-white border border-stone-200 hover:border-stone-400 hover:shadow-lg'
                        )}
                      >
                        <div className={cn(
                          "text-[10px] font-black uppercase tracking-widest mb-4",
                          isMon ? "text-stone-400" : "text-stone-400"
                        )}>
                          {day}
                        </div>
                        <div className={cn(
                          "text-2xl font-black tabular-nums",
                          isMon ? "text-white" : "text-stone-900"
                        )}>
                          ${round.toLocaleString()}
                        </div>
                        <div className={cn(
                          "text-[9px] font-bold mt-2 tabular-nums opacity-60",
                          isMon ? "text-stone-400" : "text-stone-500"
                        )}>
                          EXP: ${formatExact(exact)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center opacity-40">
                  <p className="text-sm font-black uppercase tracking-widest text-stone-400">Awaiting Valid Parameters</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
