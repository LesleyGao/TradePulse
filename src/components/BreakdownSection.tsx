import React from 'react';
import { ShieldCheck, Calendar, PieChart } from 'lucide-react';
import { cn } from '../utils/cn';

interface BreakdownSectionProps {
    callsVsPuts: any;
    stats: any;
    maxLossesPerDay: number;
    setMaxLossesPerDay: (n: number | ((prev: number) => number)) => void;
    statsPeriod: 'total' | number;
    monthSort: 'best' | 'worst' | 'date';
    setMonthSort: (s: 'best' | 'worst' | 'date') => void;
    calendarMonthSort: 'best' | 'worst' | 'date';
    setCalendarMonthSort: (s: 'best' | 'worst' | 'date') => void;
}

export const BreakdownSection = ({
    callsVsPuts,
    stats,
    maxLossesPerDay,
    setMaxLossesPerDay,
    statsPeriod,
    monthSort,
    setMonthSort,
    calendarMonthSort,
    setCalendarMonthSort,
}: BreakdownSectionProps) => {
    if (!stats) return null;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-xl font-bold text-stone-900 tracking-tight">System Breakdown</h2>
                <p className="text-sm text-stone-500 mt-1">Deep dive into your trading habits and constraints.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Calls vs Puts */}
                <div className="card flex flex-col shadow-lg shadow-stone-200/50">
                    <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-emerald-50">
                                <PieChart className="w-4 h-4 text-emerald-600" />
                            </div>
                            <span className="text-sm font-bold text-stone-800">Calls vs Puts</span>
                        </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-center">
                        {callsVsPuts.total === 0 ? (
                            <p className="text-stone-400 text-sm italic text-center py-10">No volume data.</p>
                        ) : (
                            <div className="space-y-8">
                                <div className="h-4 rounded-full overflow-hidden bg-stone-100 flex shadow-inner">
                                    <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${callsVsPuts.callPct}%` }} />
                                    <div className="bg-rose-500 transition-all duration-1000" style={{ width: `${callsVsPuts.putPct}%` }} />
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Calls</span>
                                        </div>
                                        <div className="text-2xl font-black text-stone-900">{callsVsPuts.callPct.toFixed(0)}%</div>
                                        <div className="text-xs font-bold text-stone-500">{callsVsPuts.callCount} Trades</div>
                                        <div className={cn("text-sm font-black mt-2", callsVsPuts.callWinRate >= 50 ? "text-emerald-600" : "text-rose-600")}>
                                            {callsVsPuts.callWinRate.toFixed(1)}% WR
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-rose-500" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Puts</span>
                                        </div>
                                        <div className="text-2xl font-black text-stone-900">{callsVsPuts.putPct.toFixed(0)}%</div>
                                        <div className="text-xs font-bold text-stone-500">{callsVsPuts.putCount} Trades</div>
                                        <div className={cn("text-sm font-black mt-2", callsVsPuts.putWinRate >= 50 ? "text-emerald-600" : "text-rose-600")}>
                                            {callsVsPuts.putWinRate.toFixed(1)}% WR
                                        </div>
                                    </div>
                                </div>

                                {callsVsPuts.winningType && (
                                    <div className="pt-6 border-t border-stone-100">
                                        <div className="text-xs font-bold text-stone-400 uppercase tracking-widest leading-none">Best Performer</div>
                                        <div className={cn(
                                            "text-base font-black mt-1",
                                            callsVsPuts.winningType === 'Call' ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            {callsVsPuts.winningType}s
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Risk Rules */}
                <div className="card flex flex-col shadow-lg shadow-stone-200/50">
                    <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-orange-50">
                                <ShieldCheck className="w-4 h-4 text-orange-600" />
                            </div>
                            <span className="text-sm font-bold text-stone-800">Risk Constraints</span>
                        </div>
                    </div>
                    <div className="p-6 flex-1 space-y-8">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Daily Loss Limit</span>
                                <div className="flex items-center bg-stone-100 rounded-lg p-0.5 border border-stone-200">
                                    <button onClick={() => setMaxLossesPerDay(n => Math.max(1, n - 1))} className="w-8 h-8 flex items-center justify-center font-bold text-stone-500 hover:text-stone-900">－</button>
                                    <span className="w-8 text-center font-bold text-stone-900">{maxLossesPerDay}</span>
                                    <button onClick={() => setMaxLossesPerDay(n => Math.min(20, n + 1))} className="w-8 h-8 flex items-center justify-center font-bold text-stone-500 hover:text-stone-900">＋</button>
                                </div>
                            </div>
                            <div className="bg-stone-50 rounded-2xl p-5 border border-stone-100">
                                <div className="text-xs font-bold text-stone-400 uppercase tracking-widest">Rule Consistency</div>
                                <div className={cn("text-3xl font-black mt-1", stats.ruleDaysBroke === 0 ? "text-emerald-600" : "text-orange-600")}>
                                    {stats.ruleConsistency}
                                </div>
                                <p className="text-xs font-bold text-stone-500 mt-2 uppercase tracking-tight">
                                    {stats.ruleDaysFollowed} / {stats.ruleTotalDays} Days followed
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Loss Streak Probability</span>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                {[3, 5, 7].map(n => {
                                    const prob = stats.consecutiveLossProbs?.find(p => p.streak === n);
                                    return (
                                        <div key={n} className="flex justify-between items-end border-b border-stone-100 pb-2">
                                            <span className="text-xs font-bold text-stone-500">{n} Row</span>
                                            <span className="text-sm font-black text-stone-900">{prob?.probFormatted ?? '—'}</span>
                                        </div>
                                    );
                                })}
                                <div className="flex justify-between items-end border-b border-stone-900 pb-2">
                                    <span className="text-xs font-bold text-stone-900">Current</span>
                                    <span className={cn("text-sm font-black", stats.currentLossStreak > 0 ? "text-rose-600 underline decoration-2" : "text-stone-400")}>
                                        {stats.currentLossStreak}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Monthly Performance */}
                <div className="card flex flex-col shadow-lg shadow-stone-200/50">
                    <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-blue-50">
                                <Calendar className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-bold text-stone-800">Returns by Month</span>
                        </div>

                        <select
                            value={statsPeriod !== 'total' ? monthSort : calendarMonthSort}
                            onChange={(e) => statsPeriod !== 'total' ? setMonthSort(e.target.value as any) : setCalendarMonthSort(e.target.value as any)}
                            className="text-[10px] font-black uppercase tracking-widest bg-white border border-stone-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-stone-400"
                        >
                            <option value="date">Order</option>
                            <option value="best">Best</option>
                            <option value="worst">Worst</option>
                        </select>
                    </div>

                    <div className="overflow-auto max-h-[360px] flex-1 divide-y divide-stone-50">
                        {statsPeriod !== 'total' ? (
                            stats.monthsList.filter(m => m.monthKey.startsWith(String(statsPeriod))).sort((a, b) => {
                                if (monthSort === 'best') return (b.pct ?? -Infinity) - (a.pct ?? -Infinity);
                                if (monthSort === 'worst') return (a.pct ?? Infinity) - (b.pct ?? Infinity);
                                return a.monthKey.localeCompare(b.monthKey);
                            }).map(m => (
                                <div key={m.monthKey} className="flex justify-between items-center px-6 py-3.5 hover:bg-stone-50/50 transition-colors">
                                    <span className="text-sm font-bold text-stone-700">{m.label}</span>
                                    <span className={cn("text-sm font-black tabular-nums", m.pct > 0 ? "text-emerald-600" : m.pct < 0 ? "text-rose-600" : "text-stone-400")}>
                                        {m.pctFormatted}
                                    </span>
                                </div>
                            ))
                        ) : (
                            stats.calendarMonthAvgList.sort((a, b) => {
                                if (calendarMonthSort === 'best') return (b.avgPct ?? -Infinity) - (a.avgPct ?? -Infinity);
                                if (calendarMonthSort === 'worst') return (a.avgPct ?? Infinity) - (b.avgPct ?? Infinity);
                                return a.monthNum - b.monthNum;
                            }).map(m => (
                                <div key={m.name} className="flex justify-between items-center px-6 py-3.5 hover:bg-stone-50/50 transition-colors">
                                    <span className="text-sm font-bold text-stone-700">{m.name}</span>
                                    <span className={cn("text-sm font-black tabular-nums", m.avgPct > 0 ? "text-emerald-600" : m.avgPct < 0 ? "text-rose-600" : "text-stone-400")}>
                                        {m.pctFormatted}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
