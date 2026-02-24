import React, { useState } from 'react';
import { Info, Target } from 'lucide-react';
import { cn } from '../utils/cn';

interface InsightsSectionProps {
    stats: any;
    topWorstSymbols: any[];
    topBestSymbols: any[];
}

export const InsightsSection = ({ stats, topWorstSymbols, topBestSymbols }: InsightsSectionProps) => {
    const [toggle, setToggle] = useState<'worst' | 'best'>('worst');

    if (!stats) return null;

    const insights = [
        {
            label: 'SQN Score',
            value: stats.sqnFormatted,
            condition: stats.sqn != null,
            text: () => {
                if (stats.sqn >= 3) return 'Excellent. Your system is high quality. Consider scaling position sizing.';
                if (stats.sqn >= 2) return 'Good. Consistent edge detected. Stick to your risk management.';
                if (stats.sqn >= 1.5) return 'Average. Focus on improving entry quality and execution.';
                return 'Underperforming. Review strategy and consider reducing size.';
            }
        },
        {
            label: 'Edge Detection',
            value: stats.expectancyFormatted,
            condition: stats.expectancy != null,
            text: () => stats.expectancy > 0 ? 'Positive edge confirmed. Performance indicates strategy viability.' : 'Negative edge detected. Strategy adjustments or better risk management required.'
        },
        {
            label: 'Risk/Reward Ratio',
            value: `${stats.avgWin} vs ${stats.avgLoss}`,
            condition: true,
            text: () => `Your average win is ${stats.avgWin} while average loss is ${stats.avgLoss}.`
        },
        {
            label: 'Required Win Rate',
            value: stats.breakEvenWinRateFormatted,
            condition: stats.breakEvenWinRate != null,
            text: () => {
                const diff = stats.winRateNum - stats.breakEvenWinRate;
                if (diff > 5) return `Winning! Your ${stats.winRate} win rate is well above the ${stats.breakEvenWinRateFormatted} needed to break even.`;
                if (diff > 0) return `Profitable. You are currently exceeding the ${stats.breakEvenWinRateFormatted} win rate required for your R/R.`;
                return `Attention. With your current R/R, you need a ${stats.breakEvenWinRateFormatted} win rate to be profitable.`;
            }
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Left Column: Insights */}
            <div className="flex flex-col h-full space-y-6">
                <div className="h-[68px] flex flex-col justify-center">
                    <h2 className="text-xl font-bold text-stone-900 tracking-tight">Performance Insights</h2>
                    <p className="text-sm text-stone-500 mt-1">Smart analysis of your trading data.</p>
                </div>

                <div className="card divide-y divide-stone-100 overflow-hidden bg-white shadow-xl shadow-stone-200/40 flex-1 flex flex-col">
                    <div className="flex-1">
                        {insights.map((item, i) => item.condition && (
                            <div key={i} className="p-6 flex gap-4 transition-colors hover:bg-stone-50/50">
                                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 border border-stone-200/50">
                                    <Info className="w-5 h-5 text-stone-400" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">{item.label}</span>
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-stone-900 text-white">{item.value}</span>
                                    </div>
                                    <p className="text-stone-600 mt-1.5 leading-relaxed font-medium text-sm">{item.text()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-stone-50/50 border-t border-stone-100 mt-auto">
                        <p className="text-[10px] font-black text-stone-500 flex items-center gap-2 uppercase tracking-widest leading-none">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Pro Tip: Monitor your daily loss consistency.
                        </p>
                    </div>
                </div>
            </div>

            {/* Right Column: Top Symbols */}
            <div className="flex flex-col h-full space-y-6">
                <div className="flex items-center justify-between h-[68px]">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold text-stone-900 tracking-tight">Top Performance</h2>
                        <p className="text-sm text-stone-500 mt-1 truncate">Best and worst underlying assets.</p>
                    </div>

                    <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200/50 shrink-0 ml-4">
                        <button
                            onClick={() => setToggle('worst')}
                            className={cn(
                                "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                                toggle === 'worst' ? "bg-white text-stone-900 shadow-sm shadow-stone-200/50" : "text-stone-500 hover:text-stone-800"
                            )}
                        >
                            Worst
                        </button>
                        <button
                            onClick={() => setToggle('best')}
                            className={cn(
                                "px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                                toggle === 'best' ? "bg-white text-stone-900 shadow-sm shadow-stone-200/50" : "text-stone-500 hover:text-stone-800"
                            )}
                        >
                            Best
                        </button>
                    </div>
                </div>

                <div className="card overflow-hidden shadow-xl shadow-stone-200/40 flex-1 bg-white">
                    <div className="h-full flex flex-col">
                        <table className="w-full flex-1 border-collapse">
                            <thead>
                                <tr className="text-left border-b border-stone-50">
                                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-widest text-stone-400">Rank</th>
                                    <th className="px-5 py-4 text-left text-[10px] font-black uppercase tracking-widest text-stone-400">Underlying</th>
                                    <th className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-widest text-stone-400">PnL Pct</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-50">
                                {(toggle === 'worst' ? topWorstSymbols : topBestSymbols).map((item, i) => (
                                    <tr key={item.name} className="group hover:bg-stone-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <span className="w-7 h-7 rounded-lg bg-stone-50 flex items-center justify-center text-[10px] font-black text-stone-400 group-hover:bg-stone-900 group-hover:text-white transition-all duration-300">
                                                {i < 9 ? `0${i + 1}` : i + 1}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="text-sm font-black text-stone-900">{item.name}</div>
                                        </td>
                                        <td className={cn(
                                            "px-5 py-4 text-right font-black tabular-nums text-sm",
                                            toggle === 'worst' ? "text-rose-600" : "text-emerald-600"
                                        )}>
                                            {item.pct != null ? `${item.pct >= 0 ? '+' : ''}${item.pct.toFixed(1)}%` : '—'}
                                        </td>
                                    </tr>
                                ))}
                                {(toggle === 'worst' ? topWorstSymbols : topBestSymbols).length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-5 py-16 text-center">
                                            <div className="flex flex-col items-center gap-2 opacity-30">
                                                <Target className="w-10 h-10 text-stone-400" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">No Symbol Activity</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
