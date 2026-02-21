/**
 * Position size calculator: same risk (delta exposure) every day Mon–Fri
 * for Friday-expiring options. One input: Monday $; five deltas (Mon–Fri).
 * Day N $ = Monday $ × (Monday delta ÷ Day N delta). No premium.
 */

import React, { useState, useMemo } from 'react';
import { Calculator, Info, Calendar, RotateCcw } from 'lucide-react';
import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100/80">
      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-10 space-y-8">
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-600">
            <Calculator className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 tracking-tight">
            Friday-expiry daily sizing
          </h1>
          <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
            Size each day so risk closely matches Monday. Short holds (5–30 min)—same formula.
          </p>
        </header>

        {/* Inputs card */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-6 sm:p-7 space-y-6">
          <div className="flex items-center gap-2 text-zinc-700">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <h2 className="font-semibold text-zinc-800">Inputs</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1.5">
              Monday position size ($)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={mondayDollars}
              onChange={(e) =>
                setMondayDollars(e.target.value.replace(/[^0-9.]/g, ''))
              }
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none transition-shadow"
              placeholder="1500"
            />
            <p className="mt-1.5 text-xs text-zinc-500">Baseline risk in dollars</p>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <label className="block text-sm font-medium text-zinc-700">
                Delta (Friday-expiring option, as of that day)
              </label>
              <button
                type="button"
                onClick={() => setDeltas({ ...DEFAULT_DELTAS })}
                className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 text-sm font-medium text-zinc-600 shadow-sm hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-zinc-500" />
                Reset to defaults
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-2">
              Enter delta when you enter or size (0–1). Defaults: typical 1–2 OTM weekly.
            </p>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/70 mb-3">
              <p className="text-xs text-amber-800">
                Use your platform’s Greeks for your strike for best accuracy.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {DAYS.map((day, i) => (
                <label key={day} className="block">
                  <span className="text-xs font-medium text-zinc-500 block mb-1.5">
                    {DAY_SHORT[i]}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={deltas[day]}
                    onChange={(e) =>
                      setDeltas((prev) => ({
                        ...prev,
                        [day]: e.target.value.replace(/[^0-9.]/g, ''),
                      }))
                    }
                    className="block w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none tabular-nums"
                    placeholder={DEFAULT_DELTAS[day]}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={useTheta}
                onChange={(e) => setUseTheta(e.target.checked)}
                className="rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-medium text-zinc-600 group-hover:text-zinc-800">
                Include theta (same time-decay risk over 5–30 min hold)
              </span>
            </label>
            {useTheta && (
              <div className="mt-4 pl-0">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                  Theta per share per day (e.g. -0.10)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {DAYS.map((day, i) => (
                    <label key={day} className="block">
                      <span className="text-xs text-zinc-500 block mb-1">{DAY_SHORT[i]}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={thetas[day]}
                        onChange={(e) =>
                          setThetas((prev) => ({
                            ...prev,
                            [day]: e.target.value.replace(/[^0-9.-]/g, ''),
                          }))
                        }
                        className="block w-full rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none"
                        placeholder={DEFAULT_THETAS[day]}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Results */}
        <section className="bg-zinc-900 text-white rounded-2xl shadow-lg overflow-visible">
          <div className="p-6 sm:p-8 overflow-x-auto">
            <h3 className="font-semibold text-zinc-200 flex items-center gap-2 mb-1">
              <Calculator className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="min-w-0">Daily position size — same risk as Monday</span>
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              Round number for quick use; exact value for precision.
            </p>
            {results ? (
              <div className="space-y-6 min-w-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {DAYS.map((day, i) => {
                    const exact = results.dayAmounts[day];
                    const round = roundToFifty(exact);
                    return (
                      <div
                        key={day}
                        className={cn(
                          'rounded-xl p-4 text-center min-w-0 overflow-visible',
                          day === 'Monday'
                            ? 'bg-emerald-500/20 ring-1 ring-emerald-400/50'
                            : 'bg-zinc-800/90'
                        )}
                      >
                        <div className="text-xs font-medium text-zinc-400 mb-2">
                          {DAY_SHORT[i]}
                        </div>
                        <div className="text-xl font-bold tabular-nums text-white mb-0.5 break-words">
                          ~${round.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs text-zinc-500 tabular-nums break-all">
                          Exact: ${formatExact(exact)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-sm text-zinc-400">
                  Use the round number for quick sizing; exact when you need it. Delta exposure
                  matches Monday each day.
                </p>
                {results.thetaAmounts && (
                  <div className="pt-6 border-t border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                      Same theta cost (over your hold)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {DAYS.map((day, i) => {
                        const exact = results.thetaAmounts![day];
                        const round = roundToFifty(exact);
                        return (
                          <div
                            key={day}
                            className="rounded-xl p-4 text-center bg-zinc-800/80 min-w-0 overflow-visible"
                          >
                            <div className="text-xs text-zinc-400 mb-2">{DAY_SHORT[i]}</div>
                            <div className="text-xl font-bold tabular-nums text-white mb-0.5 break-words">
                              ~${round.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs text-zinc-500 tabular-nums break-all">
                              Exact: ${formatExact(exact)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-zinc-500 mt-3">
                      Time decay over your hold matches Monday. Compare with delta-based above.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 border-dashed p-6 text-center">
                <p className="text-zinc-400 text-sm">
                  Enter Monday position size ($) and all five deltas (0–1) to see results.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Formula */}
        <section className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-6 sm:p-7 space-y-4">
          <h3 className="font-semibold text-zinc-900 flex items-center gap-2">
            <Info className="w-5 h-5 text-emerald-600" />
            Formula
          </h3>
          <p className="text-sm text-zinc-600">
            Same <strong>delta exposure</strong> as Monday (share-equivalent):
          </p>
          <div className="font-mono text-sm bg-zinc-100 text-zinc-800 rounded-xl px-4 py-3">
            Day N $ = Monday $ × (Monday delta ÷ Day N delta)
          </div>
          <p className="text-xs text-zinc-500">
            Effective shares stay constant. Example: Mon $1,500, Δ 0.50 → Tue Δ 0.58 → Tue $ =
            1,500 × (0.50/0.58) ≈ $1,293.
          </p>
          <details className="pt-2 border-t border-zinc-100">
            <summary className="text-sm font-medium text-zinc-700 cursor-pointer hover:text-zinc-900">
              Gamma &amp; theta
            </summary>
            <div className="mt-3 space-y-2 text-sm text-zinc-600">
              <p>
                <strong>Gamma</strong> — We match delta (first-order). Gamma is second-order;
                one lever can’t match both.
              </p>
              <p>
                <strong>Theta</strong> — Optional “Include theta” shows same time-decay sizing:
                Day N $ = Monday $ × (Monday |θ| ÷ Day N |θ|).
              </p>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}
