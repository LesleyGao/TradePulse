import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const date = request.nextUrl.searchParams.get('date');

  if (date) {
    const { data } = await supabase
      .from('premarket_analyses').select('*').eq('date', date).maybeSingle();
    return NextResponse.json({ data });
  }

  const { data, error } = await supabase
    .from('premarket_analyses').select('*').order('date', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const body = await request.json();

  const gexSign = (body.gex_value ?? 0) >= 0 ? 'positive' : 'negative';
  const dexSign = (body.dex_value ?? 0) >= 0 ? 'positive' : 'negative';

  const row = {
    date: body.date,
    screenshot_path: body.screenshot_path,
    qqq_price: body.qqq_price,
    vix: body.vix,
    vix_term_structure: body.vix_term_structure,
    gex_value: body.gex_value,
    gex_sign: gexSign,
    dex_value: body.dex_value,
    dex_sign: dexSign,
    dex_trend: body.dex_trend,
    call_wall: body.call_wall,
    put_wall: body.put_wall,
    gamma_flip: body.gamma_flip,
    vol_trigger: body.vol_trigger,
    hvl: body.hvl,
    zero_gamma: body.zero_gamma,
    blindspots: body.blindspots ? JSON.stringify(body.blindspots) : null,
    regime: body.regime,
    ai_recommendation: body.ai_recommendation ? JSON.stringify(body.ai_recommendation) : null,
    ai_trade_call: body.ai_trade_call,
    primary_scenario: body.primary_scenario,
    alternative_scenario: body.alternative_scenario,
    levels_to_watch: body.levels_to_watch ? JSON.stringify(body.levels_to_watch) : null,
    risk_notes: body.risk_notes,
    user_notes: body.user_notes,
  };

  const { data, error } = await supabase
    .from('premarket_analyses')
    .upsert(row, { onConflict: 'date' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
