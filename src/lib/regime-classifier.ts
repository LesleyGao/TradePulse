import type { Regime, GexSign } from './types';

export function classifyRegime(
  gexSign: GexSign,
  priceVsVolTrigger: 'above' | 'below'
): Regime {
  if (gexSign === 'positive' && priceVsVolTrigger === 'above') return 'Pinning';
  if (gexSign === 'positive' && priceVsVolTrigger === 'below') return 'Grinding';
  if (gexSign === 'negative' && priceVsVolTrigger === 'above') return 'Breakout-Ready';
  return 'Crash';
}

export function getRegimeDescription(regime: Regime): string {
  switch (regime) {
    case 'Pinning':
      return 'Positive GEX + Above Vol Trigger. Fade moves, sell premium, scalp reversals at walls.';
    case 'Grinding':
      return 'Positive GEX + Below Vol Trigger. Slow downtrend, puts favored, put wall as target.';
    case 'Breakout-Ready':
      return 'Negative GEX + Above Vol Trigger. Momentum trades, follow-through likely.';
    case 'Crash':
      return 'Negative GEX + Below Vol Trigger. Full trend mode, strong put bias, momentum entries only.';
  }
}

export function getRegimeColor(regime: Regime): string {
  switch (regime) {
    case 'Pinning': return '#8b5cf6';
    case 'Grinding': return '#f59e0b';
    case 'Breakout-Ready': return '#3b82f6';
    case 'Crash': return '#ef4444';
  }
}
