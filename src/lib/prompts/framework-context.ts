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

## VIX Context
- VIX < 15: Low vol, positive GEX dominates, small position sizes on 0DTE
- VIX 15-20: Normal regime, standard setups apply
- VIX 20-30: Elevated vol, wider stops, directional bias matters more
- VIX > 30: Crisis regime, avoid 0DTE unless strong conviction
- Contango (normal) = complacency; Backwardation = fear/hedging demand
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
`;

export const SETUP_CATALOG = `
## Setup 1: Kiss n Go (Gamma Wall Reversal)
- Trigger: First touch of a major gamma wall (Call Wall, Put Wall, Gamma Flip, HVL)
- Entry: Reversal direction (puts at Call Wall touch, calls at Put Wall touch)
- Target: Next major gamma level in reversal direction
- Stop: Wall breaks with conviction (sustained close, not just a wick)
- Best in: Any regime; strongest when dealers actively defend (positive GEX)
- Why: Dealer hedging at gamma walls creates natural support/resistance; first touch has strongest reaction

## Setup 2: Breakout / Breakdown (Gamma Wall Continuation)
- Trigger: Price breaks through a major gamma wall with volume/conviction
- Entry: Continuation direction (calls on break above, puts on break below)
- Target: Next major gamma level in breakout direction
- Stop: Price reclaims back inside the broken wall
- Best in: Negative GEX (dealer hedging amplifies moves)
- Why: Once a gamma wall breaks, dealer hedging that was containing price now amplifies the move

## Setup 3: Open Space
- Trigger: Price breaks a blindspot/intermediate level into a gap with no major walls to next significant level
- Entry: Direction of the break (puts if breaking below, calls above)
- Target: Next major gamma wall or Menthor Q level on the other side
- Stop: Price reclaims the broken intermediate level
- Best in: Breakout-Ready or Crash regime
- Why: No dealer gamma in open space to mean-revert against; moves tend to be fast and directional
`;

export const CAPITAL_RULES = `
## Capital Protection Rules (Hard Constraints)
1. Max 2-3 trades per day
2. No trading outside 9:30-11:30 ET window
3. Cut losers fast, let winners run — if setup thesis invalidated, exit immediately
4. No revenge trading — no impulsive re-entry after loss
5. Size for survival — 1-lot trades while building edge
6. If unsure, don't trade — sitting out preserves capital
7. Daily loss limit — stop trading if down $100
`;
