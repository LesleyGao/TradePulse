'use client';
import React from 'react';
import { DollarSign, Activity, TrendingUp, TrendingDown, Target, ShieldCheck, Zap } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';

interface MetricsGridProps {
    stats: any;
}

export const MetricsGrid = ({ stats }: MetricsGridProps) => {
    if (!stats) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            <StatCard
                title="Total PnL"
                value={stats.totalPnl}
                icon={DollarSign}
                trend={stats.trend}
                accent={stats.trend === 'up' ? 'emerald' : 'rose'}
                highlight
            />
            <StatCard
                title="Win Rate"
                value={stats.winRate}
                icon={Target}
                trend={stats.winRateNum >= 50 ? 'up' : 'down'}
                accent={stats.winRateNum >= 50 ? 'emerald' : 'rose'}
            />
            <StatCard
                title="Total Trades"
                value={stats.tradeCount.toString()}
                icon={Activity}
                accent="slate"
            />
            <StatCard
                title="Expectancy"
                value={stats.expectancyFormatted}
                icon={Zap}
                trend={stats.expectancy > 0 ? 'up' : 'down'}
                accent={stats.expectancy > 0 ? 'emerald' : 'rose'}
            />

            <StatCard
                title="Avg Win"
                value={stats.avgWin}
                icon={TrendingUp}
                trend="up"
                accent="emerald"
            />
            <StatCard
                title="Avg Loss"
                value={stats.avgLoss}
                icon={TrendingDown}
                trend="down"
                accent="rose"
            />
            <StatCard
                title="5-Day Rolling"
                value={stats.rolling5DayPnl}
                icon={Activity}
                trend={stats.rolling5Trend}
                accent={stats.rolling5Trend === 'up' ? 'emerald' : 'rose'}
            />
            <StatCard
                title="SQN"
                value={stats.sqnFormatted}
                icon={ShieldCheck}
                trend={stats.sqn >= 2 ? 'up' : 'down'}
                accent={stats.sqn >= 2 ? 'emerald' : 'amber'}
            />
        </div>
    );
};
