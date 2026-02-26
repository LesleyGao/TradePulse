'use client';
import React, { useState } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Line
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';

interface PnlPoint {
    date: string;
    pnl: number;
    cumulativePnl: number;
    sma20?: number;
    rolling5DayPnl?: number;
}

interface PnlChartProps {
    data: PnlPoint[];
    chartPeriod: 'daily' | 'monthly' | 'yearly';
    setChartPeriod: (period: 'daily' | 'monthly' | 'yearly') => void;
    showSma: boolean;
    setShowSma: (show: boolean) => void;
    statsPeriod: 'total' | number;
}

export const PnlChart = ({
    data,
    chartPeriod,
    setChartPeriod,
    showSma,
    setShowSma,
    statsPeriod
}: PnlChartProps) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                    <h2 className="text-xl font-bold text-stone-900 tracking-tight">Equity Curve</h2>
                    <p className="text-sm text-stone-500 mt-1">
                        {chartPeriod === 'daily' && 'Daily cumulative Performance. '}
                        Viewing {statsPeriod === 'total' ? 'all time' : statsPeriod} data.
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-stone-100/80 p-1 rounded-2xl border border-stone-200/50">
                    {(statsPeriod === 'total' ? (['daily', 'monthly', 'yearly'] as const) : (['daily', 'monthly'] as const)).map((period) => (
                        <button
                            key={period}
                            type="button"
                            onClick={() => setChartPeriod(period)}
                            className={cn(
                                'px-5 py-2 text-xs font-bold rounded-xl capitalize transition-all duration-300',
                                chartPeriod === period
                                    ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                                    : 'text-stone-500 hover:text-stone-800'
                            )}
                        >
                            {period}
                        </button>
                    ))}
                </div>
            </div>

            <div
                className={cn(
                    "card overflow-hidden transition-all duration-500",
                    isHovered ? "border-stone-400 shadow-2xl shadow-stone-200/50" : "border-stone-200 shadow-lg shadow-stone-100/50"
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
                    <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-2 text-stone-900">
                            <span className="w-4 h-1 bg-stone-900 rounded-full" />
                            Cumulative P&L
                        </span>
                        {chartPeriod === 'daily' && showSma && (
                            <span className="flex items-center gap-2 text-amber-600">
                                <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500" />
                                20D SMA
                            </span>
                        )}
                    </div>

                    {chartPeriod === 'daily' && (
                        <button
                            type="button"
                            onClick={() => setShowSma(!showSma)}
                            className={cn(
                                'px-4 py-2 text-xs font-bold rounded-xl transition-all duration-300 border',
                                showSma
                                    ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                                    : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300'
                            )}
                        >
                            SMA: {showSma ? 'ON' : 'OFF'}
                        </button>
                    )}
                </div>

                <div className="h-[400px] sm:h-[450px] w-full p-4 sm:p-6 bg-white">
                    {data.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-4 text-center opacity-50">
                            <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                                <LineChartIcon className="w-8 h-8 text-stone-400" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-stone-800">No data available</p>
                                <p className="text-sm text-stone-500 mt-1">Upload a CSV to generate your equity curve.</p>
                            </div>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={data}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1c1917" stopOpacity={0.08} />
                                        <stop offset="95%" stopColor="#1c1917" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#e7e5e4" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#78716c', fontWeight: 600 }}
                                    dy={10}
                                    tickFormatter={(value) => {
                                        try {
                                            const date = new Date(value + 'T12:00:00');
                                            if (chartPeriod === 'yearly') return format(date, 'yyyy');
                                            if (chartPeriod === 'monthly') return format(date, 'MMM yy');
                                            return format(date, 'MMM d');
                                        } catch {
                                            return value;
                                        }
                                    }}
                                    minTickGap={30}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 11, fill: '#78716c', fontWeight: 600 }}
                                    tickFormatter={(val) => {
                                        const absVal = Math.abs(val);
                                        const sign = val < 0 ? '-' : '';
                                        if (absVal >= 1000000) return `${sign}$${(absVal / 1000000).toFixed(1)}M`;
                                        if (absVal >= 1000) return `${sign}$${(absVal / 1000).toFixed(1)}k`;
                                        return `${sign}$${absVal}`;
                                    }}
                                />
                                <Tooltip
                                    cursor={{ stroke: '#a8a29e', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        borderRadius: '16px',
                                        border: '1px solid #e7e5e4',
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                                        backdropFilter: 'blur(8px)',
                                        padding: '0px',
                                    }}
                                    content={({ active, payload, label }) => {
                                        if (!active || !payload?.length || !label) return null;
                                        const point = payload[0]?.payload as PnlPoint;
                                        const date = new Date(label + 'T12:00:00');
                                        const dateLabel = format(
                                            date,
                                            chartPeriod === 'yearly' ? 'yyyy' : chartPeriod === 'monthly' ? 'MMMM yyyy' : 'EEEE, MMM d, yyyy'
                                        );

                                        return (
                                            <div className="overflow-hidden min-w-[240px]">
                                                <div className="px-5 py-3 bg-stone-900 text-white">
                                                    <div className="text-xs font-bold uppercase tracking-widest opacity-60">Performance Date</div>
                                                    <div className="text-sm font-bold mt-0.5">{dateLabel}</div>
                                                </div>
                                                <div className="px-5 py-4 space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-stone-500 font-medium text-xs uppercase tracking-wider">Net P/L</span>
                                                        <span className={cn('font-bold tabular-nums', point.pnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                                                            {point.pnl >= 0 ? '+' : ''}${point.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-3 border-t border-stone-100">
                                                        <span className="text-stone-900 font-bold text-xs uppercase tracking-wider">Cumulative</span>
                                                        <span className="font-black tabular-nums text-stone-900">
                                                            {point.cumulativePnl >= 0 ? '+' : ''}${point.cumulativePnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <ReferenceLine y={0} stroke="#a8a29e" strokeWidth={1} strokeDasharray="3 3" />
                                <Area
                                    type="monotone"
                                    dataKey="cumulativePnl"
                                    stroke="#1c1917"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorPnl)"
                                    animationDuration={1500}
                                />
                                {chartPeriod === 'daily' && showSma && (
                                    <Line
                                        type="monotone"
                                        dataKey="sma20"
                                        stroke="#d97706"
                                        strokeWidth={2}
                                        strokeDasharray="5 5"
                                        dot={false}
                                        animationDuration={1500}
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};
