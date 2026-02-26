import type { Trade, FullStats, OverallStats, DimensionStats } from './types';

export function calculateStats(trades: Trade[]): FullStats {
  return {
    overall: calculateOverall(trades),
    bySetup: calculateByDimension(trades, 'setup_type'),
    byRegime: calculateByDimension(trades, 'regime'),
    byTimeOfDay: calculateByTimeWindow(trades),
    monthly: calculateMonthly(trades),
    equityCurve: calculateEquityCurve(trades),
  };
}

function calculateOverall(trades: Trade[]): OverallStats {
  if (trades.length === 0) {
    return {
      totalTrades: 0, totalPnl: 0, winRate: 0, avgWin: 0, avgLoss: 0,
      expectancy: 0, avgHoldingMinutes: 0,
      currentStreak: { type: 'win', count: 0 }, maxWinStreak: 0, maxLossStreak: 0,
    };
  }

  const winners = trades.filter(t => (t.pnl_dollar ?? 0) > 0);
  const losers = trades.filter(t => (t.pnl_dollar ?? 0) < 0);
  const totalPnl = trades.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0);
  const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
  const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0) / winners.length : 0;
  const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0) / losers.length : 0;
  const expectancy = (winRate / 100) * avgWin + (1 - winRate / 100) * avgLoss;
  const avgHoldingMinutes = trades.reduce((s, t) => s + (t.holding_minutes ?? 0), 0) / trades.length;

  const { currentStreak, maxWinStreak, maxLossStreak } = calculateStreaks(trades);

  return {
    totalTrades: trades.length,
    totalPnl: Math.round(totalPnl * 100) / 100,
    winRate: Math.round(winRate * 10) / 10,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    avgHoldingMinutes: Math.round(avgHoldingMinutes * 10) / 10,
    currentStreak,
    maxWinStreak,
    maxLossStreak,
  };
}

function calculateByDimension(trades: Trade[], key: 'setup_type' | 'regime'): DimensionStats[] {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const label = (trade[key] as string) || 'Unknown';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(trade);
  }

  return Array.from(groups.entries()).map(([label, groupTrades]) => {
    const winners = groupTrades.filter(t => (t.pnl_dollar ?? 0) > 0);
    const losers = groupTrades.filter(t => (t.pnl_dollar ?? 0) < 0);
    const winRate = groupTrades.length > 0 ? (winners.length / groupTrades.length) * 100 : 0;
    const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0) / losers.length : 0;
    const expectancy = (winRate / 100) * avgWin + (1 - winRate / 100) * avgLoss;
    const totalPnl = groupTrades.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0);

    return {
      label,
      trades: groupTrades.length,
      wins: winners.length,
      losses: losers.length,
      winRate: Math.round(winRate * 10) / 10,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
    };
  });
}

function calculateByTimeWindow(trades: Trade[]): DimensionStats[] {
  const windows = [
    { label: '9:30-10:00', start: 9.5, end: 10 },
    { label: '10:00-10:30', start: 10, end: 10.5 },
    { label: '10:30-11:30', start: 10.5, end: 11.5 },
    { label: 'After 11:30', start: 11.5, end: 24 },
  ];

  return windows.map(({ label, start, end }) => {
    const windowTrades = trades.filter(t => {
      const d = new Date(t.entry_time);
      const decimal = d.getHours() + d.getMinutes() / 60;
      return decimal >= start && decimal < end;
    });

    const winners = windowTrades.filter(t => (t.pnl_dollar ?? 0) > 0);
    const losers = windowTrades.filter(t => (t.pnl_dollar ?? 0) < 0);
    const winRate = windowTrades.length > 0 ? (winners.length / windowTrades.length) * 100 : 0;
    const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? losers.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0) / losers.length : 0;
    const expectancy = (winRate / 100) * avgWin + (1 - winRate / 100) * avgLoss;
    const totalPnl = windowTrades.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0);

    return {
      label,
      trades: windowTrades.length,
      wins: winners.length,
      losses: losers.length,
      winRate: Math.round(winRate * 10) / 10,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      totalPnl: Math.round(totalPnl * 100) / 100,
    };
  }).filter(w => w.trades > 0);
}

function calculateMonthly(trades: Trade[]): { month: string; pnl: number; trades: number; winRate: number }[] {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades) {
    const month = trade.date.slice(0, 7); // YYYY-MM
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month)!.push(trade);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthTrades]) => {
      const winners = monthTrades.filter(t => (t.pnl_dollar ?? 0) > 0);
      const pnl = monthTrades.reduce((s, t) => s + (t.pnl_dollar ?? 0), 0);
      return {
        month,
        pnl: Math.round(pnl * 100) / 100,
        trades: monthTrades.length,
        winRate: Math.round((winners.length / monthTrades.length) * 1000) / 10,
      };
    });
}

function calculateEquityCurve(trades: Trade[]): { tradeNumber: number; cumulativePnl: number; date: string }[] {
  let cumulative = 0;
  return trades
    .sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime())
    .map((trade, i) => {
      cumulative += trade.pnl_dollar ?? 0;
      return {
        tradeNumber: i + 1,
        cumulativePnl: Math.round(cumulative * 100) / 100,
        date: trade.date,
      };
    });
}

function calculateStreaks(trades: Trade[]): {
  currentStreak: { type: 'win' | 'loss'; count: number };
  maxWinStreak: number;
  maxLossStreak: number;
} {
  let maxWin = 0, maxLoss = 0;
  let currentWin = 0, currentLoss = 0;

  const sorted = [...trades].sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime());

  for (const trade of sorted) {
    if ((trade.pnl_dollar ?? 0) > 0) {
      currentWin++;
      currentLoss = 0;
      if (currentWin > maxWin) maxWin = currentWin;
    } else if ((trade.pnl_dollar ?? 0) < 0) {
      currentLoss++;
      currentWin = 0;
      if (currentLoss > maxLoss) maxLoss = currentLoss;
    }
  }

  const lastTrade = sorted[sorted.length - 1];
  const currentType = lastTrade && (lastTrade.pnl_dollar ?? 0) > 0 ? 'win' : 'loss';
  const currentCount = currentType === 'win' ? currentWin : currentLoss;

  return {
    currentStreak: { type: currentType, count: sorted.length === 0 ? 0 : currentCount },
    maxWinStreak: maxWin,
    maxLossStreak: maxLoss,
  };
}
