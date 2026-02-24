import { useMemo } from 'react';
import { format } from 'date-fns';
import { type Trade, type PnlPoint, calculatePnl } from '../utils/pnlParser';

/** OCC-style options symbol: root (1–6 letters) + YYMMDD + C|P + 8-digit strike. */
export function isOccOptionSymbol(symbol: string): boolean {
    return /^[A-Z]{1,6}\d{6}[CP]\d{8}$/i.test(symbol.trim());
}

export interface OccParsed {
    underlying: string;
    expiration: string;
    optionType: 'Call' | 'Put';
    strike: number;
}

export function parseOccSymbol(symbol: string): OccParsed | null {
    const m = symbol.trim().match(/^([A-Z]{1,6})(\d{6})([CP])(\d{8})$/i);
    if (!m) return null;
    const [, root, yymmdd, cp, strikeStr] = m;
    const yy = parseInt(yymmdd.slice(0, 2), 10);
    const mm = parseInt(yymmdd.slice(2, 4), 10);
    const dd = parseInt(yymmdd.slice(4, 6), 10);
    const year = 2000 + yy;
    const expiration = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const strike = parseInt(strikeStr, 10) / 1000;
    return {
        underlying: root!.toUpperCase(),
        expiration,
        optionType: cp!.toUpperCase() === 'C' ? 'Call' : 'Put',
        strike,
    };
}

const OPTION_MULTIPLIER = 100;

export const useTradeStats = (trades: Trade[], statsPeriod: 'total' | number, maxLossesPerDay: number) => {
    const tradesForActivity = useMemo(
        () => trades.filter((t) => isOccOptionSymbol(t.symbol)),
        [trades]
    );

    const pnlData = useMemo(() => calculatePnl(tradesForActivity), [tradesForActivity]);

    const yearsWithData = useMemo(
        () => [...new Set(pnlData.map((p) => p.date.slice(0, 4)))].map(Number).sort((a, b) => b - a),
        [pnlData]
    );

    const groupedTradesForActivity = useMemo(() => {
        const key = (t: Trade) => `${format(t.date, 'yyyy-MM-dd')}_${t.symbol}`;
        const map = new Map<string, { date: Date; symbol: string; volume: number; netQty: number; amount: number; pnl: number }>();
        for (const t of tradesForActivity) {
            const k = key(t);
            const existing = map.get(k);
            const qty = t.type === 'BUY' ? t.quantity : -t.quantity;
            const signedAmount = t.type === 'BUY' ? t.quantity * t.price : -(t.quantity * t.price);
            const fillPnl = t.type === 'SELL'
                ? t.quantity * t.price * OPTION_MULTIPLIER
                : -(t.quantity * t.price * OPTION_MULTIPLIER);
            if (!existing) {
                map.set(k, { date: t.date, symbol: t.symbol, volume: t.quantity, netQty: qty, amount: signedAmount, pnl: fillPnl });
            } else {
                existing.volume += t.type === 'BUY' ? t.quantity : 0; // Track total contracts bought
                existing.netQty += qty;
                existing.amount += signedAmount;
                existing.pnl += fillPnl;
            }
        }
        return [...map.values()]
            .map((g) => {
                // For a closed trade, volume is what was bought. 
                // For an open or partially closed trade, it's the max volume.
                const displayQty = g.volume > 0 ? g.volume : Math.abs(g.netQty);
                // Calculate average price based on volume (to avoid 0/0)
                const avgPrice = g.volume > 0
                    ? Math.abs(tradesForActivity.filter(f => format(f.date, 'yyyy-MM-dd') === format(g.date, 'yyyy-MM-dd') && f.symbol === g.symbol && f.type === 'BUY').reduce((s, f) => s + f.price * f.quantity, 0) / g.volume)
                    : (g.netQty !== 0 ? Math.abs(g.amount) / Math.abs(g.netQty) : 0);

                return {
                    date: g.date,
                    symbol: g.symbol,
                    type: (g.netQty >= 0 ? 'BUY' : 'SELL') as 'BUY' | 'SELL',
                    quantity: displayQty,
                    price: avgPrice,
                    pnl: g.pnl,
                };
            })
            .sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [tradesForActivity]);

    const pnlDataForStats = useMemo(
        () => statsPeriod === 'total' ? pnlData : pnlData.filter((p) => p.date.startsWith(String(statsPeriod))),
        [pnlData, statsPeriod]
    );

    const groupedTradesForStats = useMemo(
        () => statsPeriod === 'total' ? groupedTradesForActivity : groupedTradesForActivity.filter((t) => format(t.date, 'yyyy') === String(statsPeriod)),
        [groupedTradesForActivity, statsPeriod]
    );

    const tradesForStats = useMemo(
        () => statsPeriod === 'total' ? tradesForActivity : tradesForActivity.filter((t) => format(t.date, 'yyyy') === String(statsPeriod)),
        [tradesForActivity, statsPeriod]
    );

    const stats = useMemo(() => {
        if (pnlData.length === 0) return null;
        const totalPnl = pnlDataForStats.length > 0 ? pnlDataForStats.reduce((s, p) => s + p.pnl, 0) : 0;
        const last5 = pnlDataForStats.slice(-5);
        const rolling5DayPnl = last5.reduce((sum, d) => sum + d.pnl, 0);

        const winningTrades = groupedTradesForStats.filter((t) => t.pnl > 0);
        const losingTrades = groupedTradesForStats.filter((t) => t.pnl < 0);
        const totalTrades = groupedTradesForStats.length;
        const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0;

        const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0;

        const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

        // Strategy Expectancy
        const winPct = totalTrades > 0 ? winningTrades.length / totalTrades : 0;
        const lossPct = totalTrades > 0 ? losingTrades.length / totalTrades : 0;
        const expectancy = totalTrades > 0 ? winPct * avgWin + lossPct * avgLoss : null;

        // Fills lookup for cost basis
        const fillsByDaySymbol = new Map<string, Trade[]>();
        for (const f of tradesForStats) {
            const key = `${format(f.date, 'yyyy-MM-dd')}_${f.symbol}`;
            const arr = fillsByDaySymbol.get(key) ?? [];
            if (arr.length === 0) fillsByDaySymbol.set(key, arr);
            arr.push(f);
        }

        const getReturnPct = (g: any) => {
            const dayKey = format(g.date, 'yyyy-MM-dd');
            const fills = fillsByDaySymbol.get(`${dayKey}_${g.symbol}`) ?? [];
            const cost = fills.filter((f) => f.type === g.type).reduce((sum, f) => sum + f.quantity * f.price * OPTION_MULTIPLIER, 0);
            return cost > 0 ? (g.pnl / cost) * 100 : null;
        };

        const winningPcts = winningTrades.map(getReturnPct).filter((p): p is number => p != null);
        const losingPcts = losingTrades.map(getReturnPct).filter((p): p is number => p != null);
        const avgWinPct = winningPcts.length > 0 ? winningPcts.reduce((a, b) => a + b, 0) / winningPcts.length : null;
        const avgLossPct = losingPcts.length > 0 ? losingPcts.reduce((a, b) => a + b, 0) / losingPcts.length : null;

        // SQN
        let sqn: number | null = null;
        if (totalTrades >= 2 && Math.abs(avgLoss) > 0 && expectancy != null) {
            const rMultiples = groupedTradesForStats.map((t) => t.pnl / Math.abs(avgLoss));
            const meanR = rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length;
            const variance = rMultiples.reduce((sum, x) => sum + (x - meanR) ** 2, 0) / (rMultiples.length - 1);
            const stdDevR = Math.sqrt(variance);
            if (stdDevR > 0) sqn = (meanR / stdDevR) * Math.sqrt(totalTrades);
        }

        // Rules consistency
        const tradesByDay: Record<string, { losses: number }> = {};
        for (const t of groupedTradesForStats) {
            const day = format(t.date, 'yyyy-MM-dd');
            if (!tradesByDay[day]) tradesByDay[day] = { losses: 0 };
            if (t.pnl < 0) tradesByDay[day].losses += 1;
        }
        const ruleTotalDays = Object.keys(tradesByDay).length;
        const ruleDaysBroke = Object.values(tradesByDay).filter((d) => d.losses > maxLossesPerDay).length;
        const ruleDaysFollowed = ruleTotalDays - ruleDaysBroke;

        // Monthly
        const byMonth: Record<string, number> = {};
        const byMonthCost: Record<string, number> = {};
        for (const p of pnlData) {
            const key = p.date.slice(0, 7);
            byMonth[key] = (byMonth[key] ?? 0) + p.pnl;
        }
        for (const t of groupedTradesForStats) {
            const key = format(t.date, 'yyyy-MM');
            const cost = fillsByDaySymbol.get(`${format(t.date, 'yyyy-MM-dd')}_${t.symbol}`)?.filter(f => f.type === t.type).reduce((s, f) => s + f.quantity * f.price * OPTION_MULTIPLIER, 0) || (t.quantity * t.price * OPTION_MULTIPLIER);
            byMonthCost[key] = (byMonthCost[key] ?? 0) + cost;
        }

        const monthsList = Object.keys(byMonth).sort().map(key => {
            const pnl = byMonth[key]!;
            const cost = byMonthCost[key] || 0;
            const pct = cost > 0 ? (pnl / cost) * 100 : null;
            return {
                monthKey: key,
                label: format(new Date(parseInt(key.split('-')[0]!), parseInt(key.split('-')[1]!) - 1, 1), 'MMM yyyy'),
                pnl,
                pct,
                pctFormatted: pct != null ? (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%' : '—'
            };
        });

        // Calendar month avg
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const calendarMonthAvgList = monthNames.map((name, i) => {
            const monthNum = i + 1;
            const pcts = monthsList.filter(m => parseInt(m.monthKey.split('-')[1]!) === monthNum).map(m => m.pct).filter((p): p is number => p != null);
            const avgPct = pcts.length > 0 ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null;
            return {
                monthNum,
                name,
                avgPct,
                pctFormatted: avgPct != null ? (avgPct >= 0 ? '+' : '') + avgPct.toFixed(1) + '%' : '—'
            };
        });

        // Top 5 symbols
        const pnlByUnderlying: Record<string, { pnl: number, cost: number }> = {};
        for (const t of groupedTradesForStats) {
            const occ = parseOccSymbol(t.symbol);
            const sym = occ?.underlying ?? t.symbol;
            if (!pnlByUnderlying[sym]) pnlByUnderlying[sym] = { pnl: 0, cost: 0 };
            pnlByUnderlying[sym].pnl += t.pnl;
            const cost = fillsByDaySymbol.get(`${format(t.date, 'yyyy-MM-dd')}_${t.symbol}`)?.filter(f => f.type === t.type).reduce((s, f) => s + f.quantity * f.price * OPTION_MULTIPLIER, 0) || (t.quantity * t.price * OPTION_MULTIPLIER);
            pnlByUnderlying[sym].cost += cost;
        }
        const symbolEntries = Object.entries(pnlByUnderlying).map(([name, data]) => ({
            name,
            pnl: data.pnl,
            pct: data.cost > 0 ? (data.pnl / data.cost) * 100 : null
        }));
        const top6WorstByUnderlying = [...symbolEntries].sort((a, b) => (a.pct ?? Infinity) - (b.pct ?? Infinity)).slice(0, 6);
        const top6BestByUnderlying = [...symbolEntries].sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity)).slice(0, 6);

        // Consecutive streaks
        const sorted = [...groupedTradesForStats].sort((a, b) => a.date.getTime() - b.date.getTime());
        let currentLossStreak = 0;
        let maxConsecutiveLossesObserved = 0;
        let tempStreak = 0;
        for (const t of sorted) {
            if (t.pnl < 0) tempStreak++; else tempStreak = 0;
            maxConsecutiveLossesObserved = Math.max(maxConsecutiveLossesObserved, tempStreak);
        }
        for (let i = sorted.length - 1; i >= 0 && sorted[i]!.pnl < 0; i--) currentLossStreak++;

        const lossRate = totalTrades > 0 ? losingTrades.length / totalTrades : 0;
        const consecutiveLossProbs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => ({
            streak: s,
            probPct: (lossRate ** s) * 100,
            probFormatted: `${((lossRate ** s) * 100).toFixed(1)}%`
        }));

        // Calls vs puts: share of trades and which type is winning more (by win rate).
        let callCount = 0;
        let putCount = 0;
        let callWins = 0;
        let putWins = 0;
        for (const t of groupedTradesForStats) {
            const occ = parseOccSymbol(t.symbol);
            if (!occ) continue;
            if (occ.optionType === 'Call') {
                callCount += 1;
                if (t.pnl > 0) callWins += 1;
            } else {
                putCount += 1;
                if (t.pnl > 0) putWins += 1;
            }
        }
        const callPct = totalTrades > 0 ? (callCount / totalTrades) * 100 : 0;
        const putPct = totalTrades > 0 ? (putCount / totalTrades) * 100 : 0;
        const callWinRate = callCount > 0 ? (callWins / callCount) * 100 : 0;
        const putWinRate = putCount > 0 ? (putWins / putCount) * 100 : 0;
        let winningType: 'Call' | 'Put' | null = null;
        if (callCount > 0 && putCount > 0) {
            if (callWinRate > putWinRate) winningType = 'Call';
            else if (putWinRate > callWinRate) winningType = 'Put';
        } else if (callCount > 0) winningType = 'Call';
        else if (putCount > 0) winningType = 'Put';

        const absAvgWin = Math.abs(avgWin);
        const absAvgLoss = Math.abs(avgLoss);
        const breakEvenWinRate = (absAvgWin > 0 && absAvgLoss > 0) ? (absAvgLoss / (absAvgWin + absAvgLoss)) * 100 : null;

        return {
            totalPnl: currencyFmt.format(totalPnl),
            trend: totalPnl >= 0 ? 'up' as const : 'down' as const,
            rolling5DayPnl: currencyFmt.format(rolling5DayPnl),
            rolling5Trend: rolling5DayPnl >= 0 ? 'up' as const : 'down' as const,
            tradeCount: totalTrades,
            winRate: `${winRate.toFixed(1)}%`,
            winRateNum: winRate,
            breakEvenWinRate,
            breakEvenWinRateFormatted: breakEvenWinRate != null ? `${breakEvenWinRate.toFixed(1)}%` : '—',
            expectancy,
            expectancyFormatted: expectancy != null ? currencyFmt.format(expectancy) : '—',
            sqn,
            sqnFormatted: sqn != null ? sqn.toFixed(2) : '—',
            avgWin: currencyFmt.format(avgWin),
            avgLoss: currencyFmt.format(avgLoss),
            avgWinPctFormatted: avgWinPct != null ? `+${avgWinPct.toFixed(1)}%` : '—',
            avgLossPctFormatted: avgLossPct != null ? `${avgLossPct.toFixed(1)}%` : '—',
            ruleConsistency: ruleTotalDays > 0 ? `${((ruleDaysFollowed / ruleTotalDays) * 100).toFixed(1)}%` : '—',
            ruleDaysFollowed,
            ruleTotalDays,
            ruleDaysBroke,
            monthsList,
            calendarMonthAvgList,
            top6WorstByUnderlying,
            top6BestByUnderlying,
            currentLossStreak,
            maxConsecutiveLossesObserved,
            consecutiveLossProbs,
            callCount,
            putCount,
            callPct,
            putPct,
            callWinRate,
            putWinRate,
            winningType
        };
    }, [pnlData, pnlDataForStats, groupedTradesForStats, tradesForStats, statsPeriod, maxLossesPerDay]);

    return {
        tradesForActivity,
        pnlData,
        yearsWithData,
        groupedTradesForActivity,
        groupedTradesForStats,
        tradesForStats,
        stats,
        pnlDataForStats
    };
};

export const OPTION_MULTIPLIER_VAL = OPTION_MULTIPLIER;
