import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseWebullCsv } from '@/lib/csv-parser';
import { checkTradeRules, getSettings } from '@/lib/rule-checker';
import type { Trade } from '@/lib/types';

export async function POST(request: NextRequest) {
  const confirm = request.nextUrl.searchParams.get('confirm') === 'true';
  const contentType = request.headers.get('content-type') || '';

  let csvText: string;
  let enrichedTrades: Array<Record<string, unknown>> | null = null;

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    csvText = await file.text();
  } else {
    const body = await request.json();
    csvText = body.csv || '';
    enrichedTrades = body.trades || null;
  }

  // Preview mode: parse CSV, return round-trips for user review
  if (!confirm || !enrichedTrades) {
    try {
      const result = parseWebullCsv(csvText);
      return NextResponse.json({
        data: {
          roundTrips: result.roundTrips,
          unmatched: result.unmatched,
          totalParsed: result.roundTrips.length,
          unmatchedCount: result.unmatched.length,
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to parse CSV';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // Confirm mode: save enriched trades to database
  const supabase = await createSupabaseServerClient();
  const settings = await getSettings(supabase);
  const insertedIds: number[] = [];

  for (const t of enrichedTrades) {
    // RoundTrip objects from the parser use camelCase; map to snake_case for DB
    const date = (t.date ?? t.date) as string;
    const entryTime = (t.entryTime ?? t.entry_time) as string;
    const callPut = (t.callPut ?? t.call_put) as string;
    const pnlDollar = (t.pnlDollar ?? t.pnl_dollar ?? null) as number | null;
    const pnlPercent = (t.pnlPercent ?? t.pnl_percent ?? null) as number | null;
    const entryPrice = (t.entryPrice ?? t.entry_price) as number | undefined;
    const exitPrice = (t.exitPrice ?? t.exit_price) as number | null;
    const exitTime = (t.exitTime ?? t.exit_time) as string | null;
    const holdingMinutes = (t.holdingMinutes ?? t.holding_minutes) as number | null;
    const qty = t.qty as number | undefined;

    // Get today's existing trades for rule checking
    const { data: todayTrades } = await supabase
      .from('trades').select('*').eq('date', date);
    const todayPnl = (todayTrades || []).reduce((s: number, tr: Trade) => s + (tr.pnl_dollar ?? 0), 0);
    const violations = checkTradeRules(
      {
        entry_time: entryTime,
        call_put: callPut,
        pnl_dollar: pnlDollar,
        pnl_percent: pnlPercent,
        entry_price: entryPrice,
        qty,
      },
      (todayTrades || []) as Trade[], todayPnl, settings
    );

    // Find matching premarket analysis
    const { data: premarket } = await supabase
      .from('premarket_analyses').select('id').eq('date', date).maybeSingle();

    // Dedup: skip if trade with same symbol+date+entry_time already exists
    const { data: existing } = await supabase.from('trades')
      .select('id').eq('symbol', t.symbol as string).eq('date', date).eq('entry_time', entryTime).maybeSingle();
    if (existing) continue;

    const { data, error } = await supabase.from('trades').insert({
      date,
      symbol: t.symbol,
      underlying: t.underlying || 'QQQ',
      expiration: t.expiration,
      strike: t.strike,
      call_put: callPut,
      side: t.side,
      qty,
      entry_price: entryPrice,
      exit_price: exitPrice,
      entry_time: entryTime,
      exit_time: exitTime,
      pnl_dollar: pnlDollar,
      pnl_percent: pnlPercent,
      holding_minutes: holdingMinutes,
      setup_type: t.setup_type ?? t.setupType ?? null,
      regime: t.regime || null,
      profit_mode: (t.profitMode ?? t.profit_mode ?? 'Quick Take') as string,
      thesis: t.thesis || null,
      what_went_right: t.what_went_right ?? t.whatWentRight ?? null,
      what_went_wrong: t.what_went_wrong ?? t.whatWentWrong ?? null,
      key_learning: t.key_learning ?? t.keyLearning ?? null,
      premarket_id: premarket?.id || null,
      is_open: false,
      rule_violations: violations.length > 0 ? JSON.stringify(violations) : null,
    }).select('id').single();

    if (!error && data) insertedIds.push(data.id);
  }

  // Auto-generate daily summaries for each unique date
  const dates = [...new Set(enrichedTrades.map(t => t.date as string))];
  for (const date of dates) {
    await supabase.rpc('generate_daily_summary', { p_date: date });
  }

  return NextResponse.json({
    data: { insertedIds, count: insertedIds.length, dates }
  }, { status: 201 });
}
