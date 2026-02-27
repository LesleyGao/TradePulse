-- TradePulse: Add profit_mode column to trades table
-- Tracks whether each trade was taken as a Quick Take or Runner

ALTER TABLE trades ADD COLUMN IF NOT EXISTS profit_mode TEXT;

-- Also add missing columns to premarket_analyses if not present
ALTER TABLE premarket_analyses ADD COLUMN IF NOT EXISTS prior_close DOUBLE PRECISION;
ALTER TABLE premarket_analyses ADD COLUMN IF NOT EXISTS vix_1d_max DOUBLE PRECISION;
ALTER TABLE premarket_analyses ADD COLUMN IF NOT EXISTS one_day_min DOUBLE PRECISION;
ALTER TABLE premarket_analyses ADD COLUMN IF NOT EXISTS one_day_max DOUBLE PRECISION;
ALTER TABLE premarket_analyses ADD COLUMN IF NOT EXISTS gex_levels TEXT;
ALTER TABLE premarket_analyses ADD COLUMN IF NOT EXISTS chop_assessment TEXT;
ALTER TABLE premarket_analyses ADD COLUMN IF NOT EXISTS vix_veto TEXT;
ALTER TABLE premarket_analyses ADD COLUMN IF NOT EXISTS profit_mode TEXT;

-- Index for profit_mode queries
CREATE INDEX IF NOT EXISTS idx_trades_profit_mode ON trades(profit_mode);
