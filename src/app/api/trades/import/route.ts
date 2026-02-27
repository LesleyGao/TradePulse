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
    const result = parseWebullCsv(csvText);
    return NextResponse.json({
      data: {
        roundTrips: result.roundTrips,
        unmatched: result.unmatched,
        totalParsed: result.roundTrips.length,
        unmatchedCount: result.unmatched.length,
      }
    });
  }

  // Confirm mode: save enriched trades to database
  const supabase = await createSupabaseServerClient();
  const settings = await getSettings(supabase);
  const insertedIds: number[] = [];

  for (const t of enrichedTrades) {
    // Get today's existing trades for rule checking
    const { data: todayTrades } = await supabase
      .from('trades').select('*').eq('date', t.date as string);
    const todayPnl = (todayTrades || []).reduce((s: number, tr: Trade) => s + (tr.pnl_dollar ?? 0), 0);
    const violations = checkTradeRules(
      {
        entry_time: t.entry_time as string,
        call_put: t.call_put as string,
        pnl_dollar: t.pnl_dollar as number | null,
        pnl_percent: t.pnl_percent as number | null,
        entry_price: t.entry_price as number | undefined,
        qty: t.qty as number | undefined,
      },
      (todayTrades || []) as Trade[], todayPnl, settings
    );

    // Find matching premarket analysis
    const { data: premarket } = await supabase
      .from('premarket_analyses').select('id').eq('date', t.date as string).maybeSingle();

    const { data, error } = await supabase.from('trades').insert({
      date: t.date,
      symbol: t.symbol,
      underlying: t.underlying || 'QQQ',
      expiration: t.expiration,
      strike: t.strike,
      call_put: t.call_put,
      side: t.side,
      qty: t.qty,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      entry_time: t.entry_time,
      exit_time: t.exit_time,
      pnl_dollar: t.pnl_dollar,
      pnl_percent: t.pnl_percent,
      holding_minutes: t.holding_minutes,
      setup_type: t.setup_type || null,
      regime: t.regime || null,
      profit_mode: (t.profit_mode as string) || 'Quick Take',
      thesis: t.thesis || null,
      what_went_right: t.what_went_right || null,
      what_went_wrong: t.what_went_wrong || null,
      key_learning: t.key_learning || null,
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
