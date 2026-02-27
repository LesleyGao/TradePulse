import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trade, RuleViolation, AppSettings } from './types';

export function checkTradeRules(
  trade: { entry_time: string; call_put: string; pnl_dollar?: number | null; pnl_percent?: number | null; entry_price?: number; qty?: number },
  todayTrades: Trade[],
  todayPnl: number,
  settings: AppSettings
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  // Rule 1: One and Done — after one profitable trade, stop for the day
  const todayWins = todayTrades.filter(t => t.pnl_dollar !== null && t.pnl_dollar > 0);
  if (todayWins.length >= 1) {
    violations.push({
      rule: 'ONE_AND_DONE',
      severity: 'violation',
      message: `Already had ${todayWins.length} winning trade(s) today — one and done rule (stop after first win)`
    });
  }

  // Rule 1b: Max 2 losses per day — after two losses, done
  const todayLosses = todayTrades.filter(t => t.pnl_dollar !== null && t.pnl_dollar < 0);
  if (todayLosses.length >= 2) {
    violations.push({
      rule: 'TWO_LOSSES_DONE',
      severity: 'violation',
      message: `Already had ${todayLosses.length} losing trades today — max 2 losses rule`
    });
  }

  // Rule 1c: Fallback max trades (for after edge is proven and one-and-done is lifted)
  if (todayTrades.length >= settings.maxTradesPerDay) {
    violations.push({
      rule: 'MAX_TRADES',
      severity: 'warning',
      message: `${todayTrades.length + 1} trades today (limit: ${settings.maxTradesPerDay})`
    });
  }

  // Rule 2: Trading window (9:35-11:30 ET) — no trades before 9:35 (let first candle close)
  const entryDate = new Date(trade.entry_time);
  const hours = entryDate.getHours();
  const minutes = entryDate.getMinutes();
  const entryDecimal = hours + minutes / 60;

  const [startH, startM] = settings.tradingWindowStart.split(':').map(Number);
  const [endH, endM] = settings.tradingWindowEnd.split(':').map(Number);
  const windowStart = startH + startM / 60;
  const windowEnd = endH + endM / 60;

  // Hard start at 9:35 (let first candle close)
  const hardStart = 9 + 35 / 60;
  if (entryDecimal < hardStart) {
    violations.push({
      rule: 'BEFORE_FIRST_CANDLE',
      severity: 'violation',
      message: `Trade entered at ${hours}:${minutes.toString().padStart(2, '0')} — before 9:35 ET (first candle must close)`
    });
  } else if (entryDecimal < windowStart || entryDecimal > windowEnd) {
    violations.push({
      rule: 'OUTSIDE_WINDOW',
      severity: 'violation',
      message: `Trade entered at ${hours}:${minutes.toString().padStart(2, '0')} — outside ${settings.tradingWindowStart}-${settings.tradingWindowEnd} ET window`
    });
  }

  // Rule 3: Daily loss limit
  if (todayPnl < -settings.dailyLossLimit) {
    violations.push({
      rule: 'LOSS_LIMIT_HIT',
      severity: 'violation',
      message: `Daily P/L is $${todayPnl.toFixed(2)} — loss limit of $${settings.dailyLossLimit} exceeded`
    });
  }

  // Rule 4: Revenge trading detection
  if (todayTrades.length > 0) {
    const prevTrade = todayTrades[todayTrades.length - 1];
    if (prevTrade.pnl_dollar !== null && prevTrade.pnl_dollar < 0 && prevTrade.exit_time) {
      const timeSinceLoss = (new Date(trade.entry_time).getTime() - new Date(prevTrade.exit_time).getTime()) / 60000;
      if (timeSinceLoss < 5 && trade.call_put === prevTrade.call_put) {
        violations.push({
          rule: 'POSSIBLE_REVENGE_TRADE',
          severity: 'warning',
          message: `Entered same direction ${Math.round(timeSinceLoss)}min after a loss`
        });
      }
    }
  }

  // Rule 5: Stop loss adherence check — prefer percentage, fall back to dollar estimate
  if (trade.pnl_percent !== undefined && trade.pnl_percent !== null && trade.pnl_percent < 0) {
    if (Math.abs(trade.pnl_percent) > 35) {
      violations.push({
        rule: 'STOP_LOSS_EXCEEDED',
        severity: 'violation',
        message: `Loss of ${Math.abs(trade.pnl_percent).toFixed(1)}% exceeds 25% hard stop (with 30% slippage threshold) — was the auto stop set?`
      });
    }
  } else if (trade.pnl_dollar !== undefined && trade.pnl_dollar !== null && trade.pnl_dollar < 0) {
    const maxExpectedLoss = settings.maxPositionSize * 0.35;
    if (Math.abs(trade.pnl_dollar) > maxExpectedLoss) {
      violations.push({
        rule: 'STOP_LOSS_EXCEEDED',
        severity: 'violation',
        message: `Loss of $${Math.abs(trade.pnl_dollar).toFixed(2)} exceeds expected max ($${maxExpectedLoss.toFixed(0)}) — was the 25% auto stop set?`
      });
    }
  }

  // Rule 6: Position sizing — total premium should not exceed max position size
  if (trade.entry_price && trade.qty) {
    const totalPremium = trade.entry_price * trade.qty * 100;
    if (totalPremium > settings.maxPositionSize) {
      violations.push({
        rule: 'POSITION_SIZE_EXCEEDED',
        severity: 'warning',
        message: `Position cost $${totalPremium.toFixed(0)} exceeds max $${settings.maxPositionSize} — size for survival`
      });
    }
  }

  return violations;
}

export async function getSettings(supabase: SupabaseClient): Promise<AppSettings> {
  const { data: rows } = await supabase.from('settings').select('key, value');
  const map = Object.fromEntries((rows || []).map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    dailyLossLimit: Number(map.daily_loss_limit || 100),
    maxTradesPerDay: Number(map.max_trades_per_day || 2),
    tradingWindowStart: map.trading_window_start || '09:30',
    tradingWindowEnd: map.trading_window_end || '11:30',
    defaultTimezone: map.default_timezone || 'America/New_York',
    stopLossPercent: Number(map.stop_loss_percent || 25),
    takeProfitPercent: Number(map.take_profit_percent || 30),
    maxPositionSize: Number(map.max_position_size || 250),
    oneAndDoneEnabled: map.one_and_done_enabled !== 'false', // default true
  };
}
