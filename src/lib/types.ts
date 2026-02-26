// ============================================================
// Core domain types for QQQ 0DTE Trading Dashboard
// ============================================================

export type Regime = 'Pinning' | 'Grinding' | 'Breakout-Ready' | 'Crash';
export type TradeCall = 'Trade' | 'No-Trade' | 'Cautious';
export type CallPut = 'C' | 'P';
export type TradeSide = 'Long' | 'Short';
export type GexSign = 'positive' | 'negative';
export type DexTrend = 'up' | 'down' | 'flat';
export type VixTermStructure = 'contango' | 'backwardation';
export type RuleSeverity = 'warning' | 'violation';

// ============================================================
// Database row types
// ============================================================

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export interface Setup {
  id: number;
  name: string;
  description: string | null;
  trigger_criteria: string | null;
  entry_rules: string | null;
  target_rules: string | null;
  stop_rules: string | null;
  best_regime: Regime | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PremarketAnalysis {
  id: number;
  date: string;
  screenshot_path: string | null;
  qqq_price: number | null;
  vix: number | null;
  vix_term_structure: VixTermStructure | null;
  gex_value: number | null;
  gex_sign: GexSign | null;
  dex_value: number | null;
  dex_sign: GexSign | null;
  dex_trend: DexTrend | null;
  call_wall: number | null;
  put_wall: number | null;
  gamma_flip: number | null;
  vol_trigger: number | null;
  hvl: number | null;
  zero_gamma: number | null;
  blindspots: string | null; // JSON array
  regime: Regime;
  ai_recommendation: string | null; // JSON
  ai_trade_call: TradeCall | null;
  primary_scenario: string | null;
  alternative_scenario: string | null;
  levels_to_watch: string | null; // JSON
  risk_notes: string | null;
  user_notes: string | null;
  created_at: string;
}

export interface Trade {
  id: number;
  date: string;
  symbol: string;
  underlying: string;
  expiration: string;
  strike: number;
  call_put: CallPut;
  side: TradeSide;
  qty: number;
  entry_price: number;
  exit_price: number | null;
  entry_time: string;
  exit_time: string | null;
  pnl_dollar: number | null;
  pnl_percent: number | null;
  holding_minutes: number | null;
  setup_type: string | null;
  regime: Regime | null;
  thesis: string | null;
  what_went_right: string | null;
  what_went_wrong: string | null;
  key_learning: string | null;
  chart_screenshot_path: string | null;
  premarket_id: number | null;
  is_open: boolean;
  rule_violations: string | null; // JSON array
  created_at: string;
  updated_at: string;
}

export interface DailySummary {
  id: number;
  date: string;
  total_pnl: number;
  trade_count: number;
  win_count: number;
  loss_count: number;
  be_count: number;
  best_trade_id: number | null;
  worst_trade_id: number | null;
  regime_predicted: Regime | null;
  regime_actual: Regime | null;
  regime_accuracy: string | null;
  regime_accuracy_note: string | null;
  adjustment_for_tomorrow: string | null;
  daily_loss_limit_hit: boolean;
  user_notes: string | null;
  premarket_id: number | null;
  created_at: string;
}

export interface EdgeRefinement {
  id: number;
  trade_count: number;
  analysis_date: string;
  trigger_type: 'milestone' | 'manual' | 'monthly';
  findings: string; // JSON
  setup_recommendations: string | null; // JSON
  strongest_edges: string | null; // JSON
  weakest_edges: string | null; // JSON
  concrete_change: string | null;
  created_at: string;
}

// ============================================================
// Input/form types
// ============================================================

export interface BlindspotLevel {
  level: number;
  label: string;
}

export interface PremarketInput {
  date: string;
  screenshotPath?: string;
  qqqPrice: number;
  vix: number;
  vixTermStructure?: VixTermStructure;
  gexValue: number;
  dexValue: number;
  dexTrend: DexTrend;
  callWall: number;
  putWall: number;
  gammaFlip?: number;
  volTrigger: number;
  hvl?: number;
  zeroGamma?: number;
  blindspots: BlindspotLevel[];
  notes?: string;
}

export interface TradeInput {
  date: string;
  symbol: string;
  setupType?: string;
  regime?: Regime;
  thesis?: string;
  whatWentRight?: string;
  whatWentWrong?: string;
  keyLearning?: string;
  chartScreenshotPath?: string;
  premarketId?: number;
}

// ============================================================
// CSV / round-trip types
// ============================================================

export interface WebullOrder {
  name: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  status: string;
  filled: number;
  totalQty: number;
  price: number;
  avgPrice: number;
  timeInForce: string;
  placedTime: string;
  filledTime: string;
}

export interface RoundTrip {
  symbol: string;
  underlying: string;
  expiration: string;
  strike: number;
  callPut: CallPut;
  side: TradeSide;
  qty: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  pnlDollar: number;
  pnlPercent: number;
  holdingMinutes: number;
  date: string;
}

export interface CsvParseResult {
  roundTrips: RoundTrip[];
  unmatched: WebullOrder[];
}

// ============================================================
// Stats types
// ============================================================

export interface DimensionStats {
  label: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  totalPnl: number;
}

export interface OverallStats {
  totalTrades: number;
  totalPnl: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  avgHoldingMinutes: number;
  currentStreak: { type: 'win' | 'loss'; count: number };
  maxWinStreak: number;
  maxLossStreak: number;
}

export interface FullStats {
  overall: OverallStats;
  bySetup: DimensionStats[];
  byRegime: DimensionStats[];
  byTimeOfDay: DimensionStats[];
  monthly: { month: string; pnl: number; trades: number; winRate: number }[];
  equityCurve: { tradeNumber: number; cumulativePnl: number; date: string }[];
}

// ============================================================
// Claude API response types
// ============================================================

export interface AiScenario {
  weight: number;
  description: string;
  setup: string;
  direction: 'Calls' | 'Puts';
  entryLevel: number;
  entryTrigger: string;
  target: number;
  stop: number;
  positionSizing?: string;
}

export interface AiPremarketResponse {
  tradeCall: TradeCall;
  tradeCallReasoning: string;
  regime: Regime;
  regimeConfidence: 'High' | 'Medium' | 'Low';
  regimeNuance: string;
  primaryScenario: AiScenario;
  alternativeScenario: AiScenario | null;
  levelsToWatch: {
    bullishAbove: { level: number; reason: string } | null;
    bearishBelow: { level: number; reason: string } | null;
    pinTarget: { level: number; reason: string } | null;
  };
  riskNotes: string[];
  historicalComparison: string | null;
}

export interface RuleViolation {
  rule: string;
  severity: RuleSeverity;
  message: string;
}

export interface AppSettings {
  dailyLossLimit: number;
  maxTradesPerDay: number;
  tradingWindowStart: string;
  tradingWindowEnd: string;
  defaultTimezone: string;
}
