-- TradePulse: Helper functions for trade import and daily summary generation.
-- Run this in Supabase SQL Editor after 001_initial_schema.sql.

-- Generate or update daily summary for a given date.
-- Called after trade imports to auto-populate the daily_summaries table.
CREATE OR REPLACE FUNCTION generate_daily_summary(p_date TEXT)
RETURNS VOID AS $$
DECLARE
  v_total_pnl DOUBLE PRECISION;
  v_trade_count INTEGER;
  v_win_count INTEGER;
  v_loss_count INTEGER;
  v_be_count INTEGER;
  v_best_id BIGINT;
  v_worst_id BIGINT;
  v_premarket_id BIGINT;
  v_regime TEXT;
  v_loss_limit DOUBLE PRECISION;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(pnl_dollar), 0),
    COUNT(*) FILTER (WHERE pnl_dollar > 0),
    COUNT(*) FILTER (WHERE pnl_dollar < 0),
    COUNT(*) FILTER (WHERE pnl_dollar = 0 OR pnl_dollar IS NULL)
  INTO v_trade_count, v_total_pnl, v_win_count, v_loss_count, v_be_count
  FROM trades WHERE date = p_date;

  IF v_trade_count = 0 THEN RETURN; END IF;

  SELECT id INTO v_best_id FROM trades WHERE date = p_date ORDER BY pnl_dollar DESC NULLS LAST LIMIT 1;
  SELECT id INTO v_worst_id FROM trades WHERE date = p_date ORDER BY pnl_dollar ASC NULLS LAST LIMIT 1;
  SELECT id, regime INTO v_premarket_id, v_regime FROM premarket_analyses WHERE date = p_date LIMIT 1;
  SELECT value::DOUBLE PRECISION INTO v_loss_limit FROM settings WHERE key = 'daily_loss_limit';

  INSERT INTO daily_summaries (
    date, total_pnl, trade_count, win_count, loss_count, be_count,
    best_trade_id, worst_trade_id, regime_predicted, daily_loss_limit_hit, premarket_id
  ) VALUES (
    p_date,
    ROUND(v_total_pnl::numeric, 2),
    v_trade_count,
    v_win_count,
    v_loss_count,
    v_be_count,
    v_best_id,
    v_worst_id,
    v_regime,
    v_total_pnl < -COALESCE(v_loss_limit, 100),
    v_premarket_id
  )
  ON CONFLICT (date) DO UPDATE SET
    total_pnl = EXCLUDED.total_pnl,
    trade_count = EXCLUDED.trade_count,
    win_count = EXCLUDED.win_count,
    loss_count = EXCLUDED.loss_count,
    be_count = EXCLUDED.be_count,
    best_trade_id = EXCLUDED.best_trade_id,
    worst_trade_id = EXCLUDED.worst_trade_id,
    regime_predicted = EXCLUDED.regime_predicted,
    daily_loss_limit_hit = EXCLUDED.daily_loss_limit_hit,
    premarket_id = EXCLUDED.premarket_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
