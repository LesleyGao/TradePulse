import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trade, RuleViolation, AppSettings } from './types';

export function checkTradeRules(
  trade: { entry_time: string; call_put: string; pnl_dollar?: number | null },
  todayTrades: Trade[],
  todayPnl: number,
  settings: AppSettings
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  // Rule 1: Max trades per day
  if (todayTrades.length >= settings.maxTradesPerDay) {
    violations.push({
      rule: 'MAX_TRADES',
      severity: 'warning',
      message: `${todayTrades.length + 1} trades today (limit: ${settings.maxTradesPerDay})`
    });
  }

  // Rule 2: Trading window (9:30-11:30 ET)
  const entryDate = new Date(trade.entry_time);
  const hours = entryDate.getHours();
  const minutes = entryDate.getMinutes();
  const entryDecimal = hours + minutes / 60;

  const [startH, startM] = settings.tradingWindowStart.split(':').map(Number);
  const [endH, endM] = settings.tradingWindowEnd.split(':').map(Number);
  const windowStart = startH + startM / 60;
  const windowEnd = endH + endM / 60;

  if (entryDecimal < windowStart || entryDecimal > windowEnd) {
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

  return violations;
}

export async function getSettings(supabase: SupabaseClient): Promise<AppSettings> {
  const { data: rows } = await supabase.from('settings').select('key, value');
  const map = Object.fromEntries((rows || []).map((r: { key: string; value: string }) => [r.key, r.value]));
  return {
    dailyLossLimit: Number(map.daily_loss_limit || 100),
    maxTradesPerDay: Number(map.max_trades_per_day || 3),
    tradingWindowStart: map.trading_window_start || '09:30',
    tradingWindowEnd: map.trading_window_end || '11:30',
    defaultTimezone: map.default_timezone || 'America/New_York',
  };
}
