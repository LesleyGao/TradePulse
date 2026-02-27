'use client';
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';
import { stripRoundTripSuffix } from '@/utils/pnlParser';

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
    onDeleteTrades: (symbol: string, dateStr: string) => void;
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
    onDeleteTrades,
}: TradeTableProps) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredGroupedTrades = groupedTradesForStats.filter(t => {
        const occ = parseOccSymbol(t.symbol);
        const underlying = (occ?.underlying ?? t.symbol).toUpperCase();
        return underlying.includes(searchQuery.toUpperCase().trim());
    });

    const totalPages = Math.max(1, Math.ceil(filteredGroupedTrades.length / pageSize));
    const safeCurrentPage = Math.min(currentTradesPage, totalPages);

    const displayedFilteredTrades = filteredGroupedTrades.slice(
        (safeCurrentPage - 1) * pageSize,
        safeCurrentPage * pageSize
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <h2 className="text-xl font-bold text-stone-900 tracking-tight">Recent Activity</h2>
                    <p className="text-sm text-stone-500 mt-1">Transaction history and individual trade fills.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 group-focus-within:text-stone-900 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search underlying..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setTradesPage(1);
                            }}
                            className="pl-11 pr-4 py-2.5 bg-stone-100 hover:bg-stone-200/50 border border-stone-200 rounded-xl text-xs font-bold text-stone-900 placeholder-stone-400 focus:ring-2 focus:ring-stone-900 focus:bg-white outline-none transition-all w-full sm:w-64"
                        />
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center gap-4 bg-stone-100 p-1 rounded-xl border border-stone-200">
                            <span className="text-xs font-black text-stone-500 px-3 tabular-nums uppercase tracking-widest">
                                Pg {safeCurrentPage} / {totalPages}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => setTradesPage(p => Math.max(1, p - 1))}
                                    disabled={safeCurrentPage === 1}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm border border-stone-200 text-stone-600 disabled:opacity-30 disabled:shadow-none hover:bg-stone-50 transition-all"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setTradesPage(p => Math.min(totalPages, (p as number) + 1))}
                                    disabled={safeCurrentPage === totalPages}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm border border-stone-200 text-stone-600 disabled:opacity-30 disabled:shadow-none hover:bg-stone-50 transition-all"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="card overflow-hidden shadow-2xl shadow-stone-200/40 border-stone-200/60">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-stone-50/80 border-b border-stone-100">
                                <th className="w-16 px-8 py-5"></th>
                                <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.25em] text-stone-400">Date Transacted</th>
                                <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.25em] text-stone-400">Underlying</th>
                                <th className="px-8 py-5 text-left text-[11px] font-black uppercase tracking-[0.25em] text-stone-400">Outcome</th>
                                <th className="px-8 py-5 text-right text-[11px] font-black uppercase tracking-[0.25em] text-stone-400">Return %</th>
                                <th className="px-8 py-5 text-right text-[11px] font-black uppercase tracking-[0.25em] text-stone-400 pr-10">PnL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 bg-white">
                            {displayedFilteredTrades.map((trade) => {
                                const key = `${format(trade.date, 'yyyy-MM-dd')}_${trade.symbol}`;
                                const isExpanded = expandedTradeKey === key;
                                const occ = parseOccSymbol(trade.symbol);
                                const underlying = occ?.underlying ?? trade.symbol;

                                // Calculate Return % for the row
                                const dayKey = format(trade.date, 'yyyy-MM-dd');
                                const fills = tradesForStats.filter(f => format(f.date, 'yyyy-MM-dd') === dayKey && f.symbol === trade.symbol);
                                const isOption = (sym: string) => /^[A-Z]{1,6}\d{6}[CP]\d{8}$/i.test(stripRoundTripSuffix(sym).trim());
                                const multiplier = isOption(trade.symbol) ? OPTION_MULTIPLIER : 1;
                                const cost = fills.filter(f => f.type === trade.type).reduce((sum, f) => sum + (f.quantity * f.price * multiplier), 0);
                                const returnPct = cost > 0 ? (trade.pnl / cost) * 100 : null;

                                return (
                                    <React.Fragment key={key}>
                                        <tr
                                            onClick={() => onRowClick(key)}
                                            className={cn(
                                                "group cursor-pointer transition-all duration-300",
                                                isExpanded ? "bg-stone-50/50" : "hover:bg-stone-50/80"
                                            )}
                                        >
                                            <td className="px-8 py-6">
                                                <div className={cn(
                                                    "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300",
                                                    isExpanded ? "bg-stone-900 text-white shadow-lg shadow-stone-200" : "bg-stone-100 text-stone-400 group-hover:bg-stone-200 group-hover:text-stone-600"
                                                )}>
                                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="text-base font-black text-stone-900">{format(trade.date, 'MMM d, yyyy')}</div>
                                                <div className="text-xs font-black text-stone-400 uppercase tracking-widest mt-1">{format(trade.date, 'hh:mm a')}</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="text-base font-black text-stone-900 tracking-tight">{underlying}</div>
                                                <div className="text-[10px] font-black text-stone-400 uppercase tracking-[0.1em] mt-1">{trade.quantity} Contracts</div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className={cn(
                                                    "inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-[0.1em] border shadow-sm",
                                                    trade.pnl >= 0
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                                        : "bg-rose-50 text-rose-700 border-rose-100"
                                                )}>
                                                    {trade.pnl >= 0 ? 'Winning' : 'Losing'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className={cn(
                                                    "text-base font-black tabular-nums tracking-tighter",
                                                    returnPct != null && returnPct > 0 ? "text-emerald-600" : returnPct != null && returnPct < 0 ? "text-rose-600" : "text-stone-400"
                                                )}>
                                                    {returnPct != null ? `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%` : '—'}
                                                </div>
                                            </td>
                                            <td className="px-8 py-6 text-right pr-10">
                                                <div className={cn(
                                                    "text-base font-black tabular-nums tracking-tighter",
                                                    trade.pnl >= 0 ? "text-emerald-700" : "text-rose-700"
                                                )}>
                                                    {trade.pnl >= 0 ? '+' : '−'}${Math.abs(trade.pnl).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                                                            <div className="flex flex-col justify-center items-end">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (window.confirm(`Delete all ${fills.length} fills for ${underlying} on this date?`)) {
                                                                            onDeleteTrades(stripRoundTripSuffix(trade.symbol), format(trade.date, 'yyyy-MM-dd'));
                                                                        }
                                                                    }}
                                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100 group"
                                                                >
                                                                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                                                    <span className="text-[10px] font-black uppercase tracking-widest">Delete Trades</span>
                                                                </button>
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
