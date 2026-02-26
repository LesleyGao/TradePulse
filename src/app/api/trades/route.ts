import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = request.nextUrl;
  const date = searchParams.get('date');
  const setup = searchParams.get('setup');
  const regime = searchParams.get('regime');

  let query = supabase.from('trades').select('*');

  if (date) query = query.eq('date', date);
  if (setup) query = query.eq('setup_type', setup);
  if (regime) query = query.eq('regime', regime);

  const { data, error } = await query.order('entry_time', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const body = await request.json();

  const { data, error } = await supabase.from('trades').insert({
    date: body.date,
    symbol: body.symbol,
    underlying: body.underlying || 'QQQ',
    expiration: body.expiration,
    strike: body.strike,
    call_put: body.call_put,
    side: body.side,
    qty: body.qty,
    entry_price: body.entry_price,
    exit_price: body.exit_price,
    entry_time: body.entry_time,
    exit_time: body.exit_time,
    pnl_dollar: body.pnl_dollar,
    pnl_percent: body.pnl_percent,
    holding_minutes: body.holding_minutes,
    setup_type: body.setup_type,
    regime: body.regime,
    thesis: body.thesis,
    what_went_right: body.what_went_right,
    what_went_wrong: body.what_went_wrong,
    key_learning: body.key_learning,
    chart_screenshot_path: body.chart_screenshot_path,
    premarket_id: body.premarket_id,
    is_open: body.is_open ?? false,
    rule_violations: body.rule_violations ? JSON.stringify(body.rule_violations) : null,
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { id: data.id } }, { status: 201 });
}
