export const FRAMEWORK_CONTEXT = `
## GEX (Gamma Exposure)
- Positive GEX = dealers long gamma → sell rallies, buy dips → market mean-reverts, range-bound
- Negative GEX = dealers short gamma → buy rallies, sell dips → market trends, volatile
- Magnitude = how strong the dealer influence is

## DEX (Delta Exposure)
- Positive DEX = dealers net long delta → bearish (need to sell to hedge)
- Negative DEX = dealers net short delta → bullish (need to buy to hedge)
- DEX shift direction matters more than absolute level

## Key Levels
- Call Wall: Highest positive gamma concentration (calls) → Major resistance
- Put Wall: Highest negative gamma concentration (puts) → Major support
- Gamma Flip: Strike where net GEX flips positive to negative → Critical pivot zone
- Vol Trigger / HVL: Level where IV compresses below, expands above → Volatility regime boundary
- Blindspot (Menthor Q): Intermediate inflection between major gamma walls → Secondary support/resistance
- 1D Min / 1D Max: Expected move range for the day → Key boundaries for regime behavior

## VIX Context
- VIX < 15: Low vol, positive GEX dominates, small position sizes on 0DTE
- VIX 15-20: Normal regime, standard setups apply
- VIX 20-30: Elevated vol, wider stops, directional bias matters more
- VIX > 30: Crisis regime, avoid 0DTE unless strong conviction
- Contango (normal) = complacency; Backwardation = fear/hedging demand

## VIX as Veto (Real-Time Filter)
VIX is a VETO, not a TRIGGER. Do not wait for VIX to confirm — use it to disconfirm:
- VIX rising or holding above its 1D Max → no veto, trade is supported
- VIX fading below 1D Max → VETO: skip the trade or Quick Take only
- VIX collapsing toward HVL/Call Wall → fear is leaving, range/bounce day
Key VIX levels to track: 1D Max, RT T-1, HVL, Call Resistance 0DTE
`;

export const REGIME_DEFINITIONS = `
## Regime Classification (2x2 Matrix)
1. Pinning = Positive GEX + Price Above Vol Trigger
   - Dealers defend walls. Market range-bound.
   - Strategy: Fade moves, sell premium, scalp reversals at walls. Tight ranges.

2. Grinding = Positive GEX + Price Below Vol Trigger
   - Slow grind lower. Dealers still dampen volatility but downside bias.
   - Strategy: Puts favored. Target Put Wall. Smaller positions.

3. Breakout-Ready = Negative GEX + Price Above Vol Trigger
   - Dealer hedging amplifies moves. Follow-through likely.
   - Strategy: Momentum trades. Enter on breaks of gamma levels. Let winners run.

4. Crash = Negative GEX + Price Below Vol Trigger
   - Full trend mode. Dealers short gamma accelerate moves.
   - Strategy: Strong put bias. Momentum entries only. Avoid fading.
   - IMPORTANT: Crash regime guarantees magnitude, NOT direction. Moves are fast both ways.
`;

export const CHOP_ASSESSMENT = `
## Chop vs. Follow-Through Assessment
After regime classification, run this checklist. This OVERRIDES directional bias — a Crash regime can still chop.

1. How much of the 1D range has the overnight gap consumed?
   - Gap > 30% of 1D expected range → chop more likely, default Quick Take
   - Gap < 15% or flat → full range available, regime direction more likely

2. How far is price from the nearest major wall?
   - Within 3 points of Put Wall or Call Wall → bounce likely before break
   - 5+ points of open space → directional move has room

3. How many levels between price and the target?
   - 3+ levels in 5 points = traffic jam → chop / mean-reversion
   - 1 or fewer levels in 5 points = open space → directional follow-through

4. Level density asymmetry: which side has more room to run?
   - Dense levels below, sparse above → downside hedged, upside has room
   - Dense levels above, sparse below → upside capped, downside favors puts
   - Dense both sides → range day, Quick Take only

If 2+ signals point to chop → primary scenario is RANGE regardless of regime.
Adjust: default Quick Take, Kiss n Go scalps at range extremes, lower directional conviction.
`;

export const SETUP_CATALOG = `
## Setup 1: Kiss n Go (Gamma Wall Reversal)
- Trigger: First touch of a major gamma wall (Call Wall, Put Wall, Gamma Flip, HVL)
- Entry: Reversal direction (puts at Call Wall touch, calls at Put Wall touch)
- Target: Next major gamma level in reversal direction
- Stop: Wall breaks with conviction (sustained 5-min body close, not just a wick). Hard auto stop at 25%.
- Profit: ALWAYS Quick Take (20-30% and out). If bounce carries through a major level, it's now a Breakout (Setup 2).
- Best in: Any regime; strongest when dealers actively defend (positive GEX)

## Setup 2: Breakout / Breakdown (Gamma Wall Continuation)
- Trigger: Price breaks through a major gamma wall with volume/conviction
- Entry: Continuation direction (calls on break above, puts on break below)
- Target: Next major gamma level in breakout direction
- Stop: Price reclaims back inside the broken wall. Hard auto stop at 25%.
- Profit: Runner mode ONLY when ALL conditions met: (1) major wall breaks, (2) 5-min body close beyond, (3) open space 3+ pts, (4) VIX not fading, (5) entered ATM/ITM. Otherwise Quick Take.
- Best in: Negative GEX (dealer hedging amplifies moves)

## Setup 3: Open Space
- Trigger: Price breaks a blindspot/intermediate level into a gap with no major walls to next significant level
- Entry: Direction of the break (puts if breaking below, calls above)
- Target: Next major gamma wall or Menthor Q level on the other side
- Stop: Price reclaims the broken intermediate level. Hard auto stop at 25%.
- Profit: Runner mode if VIX supports and entered ATM/ITM. Otherwise Quick Take.
- Best in: Breakout-Ready or Crash regime
`;

export const CAPITAL_RULES = `
## Capital Protection Rules (Hard Constraints)
1. ONE AND DONE (until edge proven): After one profitable trade, stop for the day. Only exception: genuinely new setup at different level. After one loss, one more attempt at better entry. After two losses, done. Upgrade to 2-3/day after 20+ trades show positive expectancy.
2. No trading outside 9:30-11:30 ET window. No trades before 9:35 (let first candle close).
3. Cut losers fast, take profits per regime: Quick Take (20-30%) is default. Runner only when ALL conditions met. Never upgrade mid-trade.
4. No revenge trading — no re-entry within 5 min of a loss in same direction.
5. Size for survival — 1-lot ($250 max) while building edge.
6. If unsure, don't trade — sitting out preserves capital.
7. Daily loss limit $100 — stop trading if hit.
8. Hard stop at 25% loss on every trade (auto stop-loss in Webull). With slippage fills ~28-30%. Maintains ~1:1 R:R with 30% take profit. Never move stop further away.

## Profit-Taking Framework
- Mode 1 QUICK TAKE (default): Take 100% off at 20-30% profit. Use for all intermediate levels, all first trades of day, all chop/range days.
- Mode 2 RUNNER (confirmed breakdowns only): Take half at first target, trail rest. ALL 5 conditions must be met: major wall break, body close beyond, open space, VIX confirming, ATM entry.
- RULE: Never upgrade from Quick Take to Runner mid-trade. Decide before entry.
- After a Quick Take win: did the structure change? If same range, same levels → done for the day.
`;

export const OVERNIGHT_GAP_CONTEXT = `
## Overnight Gap Assessment
Always compare pre-market price to prior day's close:
- Gap down > 3pts in Crash regime: "crash" may have happened overnight. Session often sees partial gap fill bounce before continuation. Don't assume breakdown extends.
- Gap down in Pinning: likely fills. Dealers long gamma pull price back.
- Gap up in Breakout-Ready: momentum may continue. Watch for gap fill rejection at prior close.
- Key rule: large overnight gap has consumed part of the expected move. Adjust targets — 1D Min/Max was calculated before the gap.
`;
