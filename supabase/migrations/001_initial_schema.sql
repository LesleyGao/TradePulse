-- TradePulse: Initial Postgres schema (migrated from SQLite)
-- Run this in Supabase SQL Editor once after creating the project.

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('daily_loss_limit', '100'),
  ('max_trades_per_day', '3'),
  ('trading_window_start', '09:30'),
  ('trading_window_end', '11:30'),
  ('default_timezone', 'America/New_York')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE setups (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  trigger_criteria TEXT,
  entry_rules TEXT,
  target_rules TEXT,
  stop_rules TEXT,
  best_regime TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO setups (name, description, trigger_criteria, entry_rules, target_rules, stop_rules, best_regime) VALUES
  ('Kiss n Go',
   'Gamma Wall Reversal. First touch of a major gamma wall — price reverses off the wall.',
   'QQQ touches a major gamma level (Call Wall, Put Wall, or Gamma Flip) for the first time in the session. Must be first touch — no re-tests. Look for rejection candle.',
   'Touching Call Wall: long puts. Touching Put Wall: long calls. Touching Gamma Flip: reversal direction. 0DTE ATM or one strike OTM.',
   'Next major gamma level in the reversal direction, or halfway if levels are far apart.',
   'Price pushes through the wall with conviction (sustained break, not just a wick). If wall breaks, thesis is dead.',
   'Pinning'),
  ('Breakout / Breakdown',
   'Gamma Wall Continuation. Price breaks through a major gamma wall — enter continuation.',
   'Price breaks through a major gamma level with conviction. Candle closes beyond level, volume on break, no immediate reclaim. Can follow a failed Kiss n Go.',
   'Breaking above Call Wall/Gamma Flip: long calls. Breaking below Put Wall/Gamma Flip: long puts. 0DTE ATM or slightly ITM.',
   'Next major gamma level in the breakout direction. In negative GEX, moves can extend further.',
   'Price reclaims back inside the broken wall.',
   'Breakout-Ready'),
  ('Open Space',
   'Break through intermediate level into a gap with no major walls. Ride to next significant level.',
   'Price breaks a Menthor Q blindspot or intermediate level. Gap with no major walls between here and next significant level. DEX supports direction.',
   'Break below into open space: long puts. Break above: long calls. 0DTE, strike near or slightly ITM of broken level.',
   'Next major gamma wall or Menthor Q level on the other side of the open space.',
   'Price reclaims the broken level.',
   'Breakout-Ready')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE premarket_analyses (
  id BIGSERIAL PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  screenshot_path TEXT,
  qqq_price DOUBLE PRECISION,
  vix DOUBLE PRECISION,
  vix_term_structure TEXT,
  gex_value DOUBLE PRECISION,
  gex_sign TEXT,
  dex_value DOUBLE PRECISION,
  dex_sign TEXT,
  dex_trend TEXT,
  call_wall DOUBLE PRECISION,
  put_wall DOUBLE PRECISION,
  gamma_flip DOUBLE PRECISION,
  vol_trigger DOUBLE PRECISION,
  hvl DOUBLE PRECISION,
  zero_gamma DOUBLE PRECISION,
  blindspots TEXT,
  regime TEXT NOT NULL,
  ai_recommendation TEXT,
  ai_trade_call TEXT,
  primary_scenario TEXT,
  alternative_scenario TEXT,
  levels_to_watch TEXT,
  risk_notes TEXT,
  user_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE trades (
  id BIGSERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  symbol TEXT NOT NULL,
  underlying TEXT NOT NULL DEFAULT 'QQQ',
  expiration TEXT NOT NULL,
  strike DOUBLE PRECISION NOT NULL,
  call_put TEXT NOT NULL,
  side TEXT NOT NULL,
  qty INTEGER NOT NULL,
  entry_price DOUBLE PRECISION NOT NULL,
  exit_price DOUBLE PRECISION,
  entry_time TEXT NOT NULL,
  exit_time TEXT,
  pnl_dollar DOUBLE PRECISION,
  pnl_percent DOUBLE PRECISION,
  holding_minutes DOUBLE PRECISION,
  setup_type TEXT,
  regime TEXT,
  thesis TEXT,
  what_went_right TEXT,
  what_went_wrong TEXT,
  key_learning TEXT,
  chart_screenshot_path TEXT,
  premarket_id BIGINT REFERENCES premarket_analyses(id),
  is_open BOOLEAN DEFAULT false,
  rule_violations TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE daily_summaries (
  id BIGSERIAL PRIMARY KEY,
  date TEXT NOT NULL UNIQUE,
  total_pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
  trade_count INTEGER NOT NULL DEFAULT 0,
  win_count INTEGER NOT NULL DEFAULT 0,
  loss_count INTEGER NOT NULL DEFAULT 0,
  be_count INTEGER NOT NULL DEFAULT 0,
  best_trade_id BIGINT REFERENCES trades(id),
  worst_trade_id BIGINT REFERENCES trades(id),
  regime_predicted TEXT,
  regime_actual TEXT,
  regime_accuracy TEXT,
  regime_accuracy_note TEXT,
  adjustment_for_tomorrow TEXT,
  daily_loss_limit_hit BOOLEAN DEFAULT false,
  user_notes TEXT,
  premarket_id BIGINT REFERENCES premarket_analyses(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE edge_refinements (
  id BIGSERIAL PRIMARY KEY,
  trade_count INTEGER NOT NULL,
  analysis_date TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  findings TEXT NOT NULL,
  setup_recommendations TEXT,
  strongest_edges TEXT,
  weakest_edges TEXT,
  concrete_change TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_trades_date ON trades(date);
CREATE INDEX idx_trades_setup_type ON trades(setup_type);
CREATE INDEX idx_trades_regime ON trades(regime);
CREATE INDEX idx_trades_premarket_id ON trades(premarket_id);
CREATE INDEX idx_premarket_date ON premarket_analyses(date);
CREATE INDEX idx_daily_summaries_date ON daily_summaries(date);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE premarket_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE edge_refinements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON setups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON premarket_analyses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON trades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON daily_summaries FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON edge_refinements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Storage buckets (run in Supabase Dashboard > Storage instead)
-- These are here for reference only:
--   Bucket: gex-screenshots (private)
--   Bucket: chart-screenshots (private)
-- ============================================================
