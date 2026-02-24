import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../utils/cn';

interface TradeTableProps {
    displayedTrades: any[];
    groupedTradesForStats: any[];
    currentTradesPage: number;
    tradesTotalPages: number;
    setTradesPage: (n: number | ((prev: number) => number)) => void;
    pageSize: number;
    onRowClick: (key: string) => void;
    expandedTradeKey: string | null;
    tradesForStats: any[];
    parseOccSymbol: (s: string) => any;
    OPTION_MULTIPLIER: number;
}

export const TradeTable = ({
    displayedTrades,
    groupedTradesForStats,
    currentTradesPage,
    tradesTotalPages,
    setTradesPage,
    pageSize,
    onRowClick,
    expandedTradeKey,
    tradesForStats,
    parseOccSymbol,
    OPTION_MULTIPLIER,
}: TradeTableProps) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <h2 className="text-xl font-bold text-stone-900 tracking-tight">Recent Activity</h2>
                    <p className="text-sm text-stone-500 mt-1">Transaction history and individual trade fills.</p>
                </div>

                {tradesTotalPages > 1 && (
                    <div className="flex items-center gap-4 bg-stone-100 p-1 rounded-xl border border-stone-200">
                        <span className="text-xs font-black text-stone-500 px-3 tabular-nums uppercase tracking-widest">
                            Pg {currentTradesPage} / {tradesTotalPages}
                        </span>
                        <div className="flex gap-1">
                            <button
                                onClick={() => setTradesPage(p => Math.max(1, p - 1))}
                                disabled={currentTradesPage === 1}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm border border-stone-200 text-stone-600 disabled:opacity-30 disabled:shadow-none hover:bg-stone-50 transition-all"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setTradesPage(p => Math.min(tradesTotalPages, p + 1))}
                                disabled={currentTradesPage === tradesTotalPages}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm border border-stone-200 text-stone-600 disabled:opacity-30 disabled:shadow-none hover:bg-stone-50 transition-all"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="card overflow-hidden shadow-2xl shadow-stone-200/40 border-stone-200/60">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-stone-50/80 border-b border-stone-100">
                                <th className="w-12 px-6 py-4"></th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Date</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Underlying</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Type</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-stone-400">Return %</th>
                                <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 pr-8">P&L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 bg-white">
                            {displayedTrades.map((trade) => {
                                const key = `${format(trade.date, 'yyyy-MM-dd')}_${trade.symbol}`;
                                const isExpanded = expandedTradeKey === key;
                                const occ = parseOccSymbol(trade.symbol);
                                const underlying = occ?.underlying ?? trade.symbol;

                                // Calculate Return % for the row
                                const dayKey = format(trade.date, 'yyyy-MM-dd');
                                const fills = tradesForStats.filter(f => format(f.date, 'yyyy-MM-dd') === dayKey && f.symbol === trade.symbol);
                                const cost = fills.filter(f => f.type === trade.type).reduce((sum, f) => sum + (f.quantity * f.price * OPTION_MULTIPLIER), 0);
                                const returnPct = cost > 0 ? (trade.pnl / cost) * 100 : null;

                                return (
                                    <React.Fragment key={key}>
                                        <tr
                                            onClick={() => onRowClick(key)}
                                            className={cn(
                                                "group cursor-pointer transition-all duration-300",
                                                isExpanded ? "bg-stone-50/50" : "hover:bg-stone-50/50"
                                            )}
                                        >
                                            <td className="px-6 py-4">
                                                <div className={cn(
                                                    "w-6 h-6 rounded-lg flex items-center justify-center transition-all",
                                                    isExpanded ? "bg-stone-900 text-white shadow-md shadow-stone-200" : "bg-stone-100 text-stone-400"
                                                )}>
                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5 group-hover:scale-125" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-stone-900">{format(trade.date, 'MMM d, yyyy')}</div>
                                                <div className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-0.5">{format(trade.date, 'hh:mm a')}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-black text-stone-900">{underlying}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                                                    trade.pnl >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                                )}>
                                                    {trade.pnl >= 0 ? 'Winning' : 'Losing'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className={cn(
                                                    "text-sm font-black tabular-nums",
                                                    returnPct != null && returnPct > 0 ? "text-emerald-600" : returnPct != null && returnPct < 0 ? "text-rose-600" : "text-stone-400"
                                                )}>
                                                    {returnPct != null ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%` : '—'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right pr-8">
                                                <div className={cn(
                                                    "text-sm font-black tabular-nums",
                                                    trade.pnl >= 0 ? "text-emerald-700" : "text-rose-700"
                                                )}>
                                                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                        </tr>

                                        {isExpanded && (
                                            <tr className="bg-stone-50/80">
                                                <td colSpan={6} className="px-8 py-0">
                                                    <div className="py-6 space-y-4 border-l-2 border-stone-200 pl-6 ml-2 my-2">
                                                        <div className="flex gap-10">
                                                            <div>
                                                                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Position Specs</div>
                                                                <div className="text-xs font-bold text-stone-700">
                                                                    {occ ? `${occ.optionType} · Strike $${occ.strike} · Exp ${occ.expiration}` : 'Manual Fill'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Average Price</div>
                                                                <div className="text-xs font-bold text-stone-700">${trade.price.toFixed(2)}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Contracts</div>
                                                                <div className="text-xs font-bold text-stone-700">{trade.quantity}</div>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Fill Details</div>
                                                            <div className="bg-white rounded-xl border border-stone-200/50 p-3 space-y-1 shadow-sm">
                                                                {fills.map((f, idx) => (
                                                                    <div key={idx} className="flex justify-between items-center text-[11px]">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className={cn(
                                                                                "font-black tracking-tighter",
                                                                                f.type === 'BUY' ? "text-emerald-600" : "text-stone-400"
                                                                            )}>{f.type}</span>
                                                                            <span className="font-bold text-stone-800">{f.quantity} × ${f.price.toFixed(2)}</span>
                                                                        </div>
                                                                        <span className="text-stone-400 font-medium">{format(f.date, 'hh:mm:ss a')}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {displayedTrades.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-20 text-center">
                                        <p className="text-lg font-bold text-stone-400 uppercase tracking-widest">No matching transactions</p>
                                        <p className="text-sm text-stone-400 mt-2">Try adjusting your filters or upload new data.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
