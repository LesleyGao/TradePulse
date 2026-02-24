import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../utils/cn';

interface TradeTableProps {
    displayedTrades: any[];
    groupedTradesForStats: any[];
    onRowClick: (key: string) => void;
    expandedTradeKey: string | null;
    tradesForStats: any[];
    parseOccSymbol: (s: string) => any;
    OPTION_MULTIPLIER: number;
}

export const TradeTable = ({
    displayedTrades,
    groupedTradesForStats,
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
                                                    <div className="py-10 space-y-8 border-l-4 border-stone-200 pl-10 ml-2 my-4">
                                                        {/* Top Specs Grid */}
                                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
                                                            <div className="space-y-2">
                                                                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Position Specs</div>
                                                                <div className="text-base font-black text-stone-900 flex items-center gap-3">
                                                                    {occ ? (
                                                                        <>
                                                                            <span className="px-2 py-0.5 rounded-lg bg-stone-900 text-white text-[10px] tracking-widest">{occ.optionType}</span>
                                                                            <span>${occ.strike} Strike</span>
                                                                            <span className="text-stone-300">·</span>
                                                                            <span className="text-stone-500">{format(new Date(occ.expiration + 'T00:00:00'), 'MMM d')}</span>
                                                                        </>
                                                                    ) : 'Manual Trade'}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Avg Cost Basis</div>
                                                                <div className="text-lg font-black text-stone-900">${trade.price.toFixed(2)}</div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Total Size</div>
                                                                <div className="text-lg font-black text-stone-900">{trade.quantity} <span className="text-[11px] text-stone-400 ml-1 font-black uppercase tracking-widest">Contracts</span></div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Net Profit</div>
                                                                <div className={cn(
                                                                    "text-lg font-black tabular-nums",
                                                                    trade.pnl >= 0 ? "text-emerald-600" : "text-rose-600"
                                                                )}>
                                                                    {trade.pnl >= 0 ? '+' : '−'}${Math.abs(trade.pnl).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Fill History */}
                                                        <div className="space-y-4">
                                                            <div className="flex items-center justify-between pr-8">
                                                                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400">Transaction Fill History</div>
                                                                <div className="px-3 py-1 rounded-full bg-stone-100 text-[10px] font-black text-stone-500 uppercase tracking-widest">{fills.length} Fills</div>
                                                            </div>
                                                            <div className="bg-white rounded-3xl border border-stone-200/80 overflow-hidden shadow-xl shadow-stone-200/20">
                                                                <div className="divide-y divide-stone-50">
                                                                    {fills.map((f, idx) => {
                                                                        const fillReturn = f.type === 'SELL' && trade.price > 0
                                                                            ? ((f.price - trade.price) / trade.price) * 100
                                                                            : null;

                                                                        return (
                                                                            <div key={idx} className="flex justify-between items-center p-6 hover:bg-stone-50/50 transition-all duration-300">
                                                                                <div className="flex items-center gap-10">
                                                                                    <div className={cn(
                                                                                        "w-16 py-1.5 rounded-xl text-center text-[10px] font-black uppercase tracking-[0.1em]",
                                                                                        f.type === 'BUY' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-stone-100 text-stone-600 border border-stone-200"
                                                                                    )}>
                                                                                        {f.type}
                                                                                    </div>
                                                                                    <div className="flex items-baseline gap-3">
                                                                                        <span className="text-base font-black text-stone-900">{f.quantity}</span>
                                                                                        <span className="text-xs text-stone-400 font-black uppercase tracking-widest">at</span>
                                                                                        <span className="text-base font-black text-stone-900">${f.price.toFixed(2)}</span>
                                                                                    </div>
                                                                                    {fillReturn !== null && (
                                                                                        <div className={cn(
                                                                                            "flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md",
                                                                                            fillReturn >= 0 ? "bg-emerald-600 text-white shadow-emerald-200" : "bg-rose-600 text-white shadow-rose-200"
                                                                                        )}>
                                                                                            <span className="tabular-nums">{fillReturn >= 0 ? '+' : ''}{fillReturn.toFixed(1)}%</span>
                                                                                            <span className="text-[9px] border-l border-white/30 pl-2 font-black tracking-widest">
                                                                                                {fillReturn >= 0 ? 'GAIN' : 'LOSS'}
                                                                                            </span>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                                <div className="text-right">
                                                                                    <div className="text-xs font-black text-stone-900 tracking-tight">{format(f.date, 'hh:mm:ss a')}</div>
                                                                                    <div className="text-[9px] font-black text-stone-400 uppercase tracking-widest mt-0.5">{format(f.date, 'MMM d')}</div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
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
