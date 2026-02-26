import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('setups').select('*').order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const body = await request.json();

  const { data, error } = await supabase.from('setups').insert({
    name: body.name,
    description: body.description,
    trigger_criteria: body.trigger_criteria,
    entry_rules: body.entry_rules,
    target_rules: body.target_rules,
    stop_rules: body.stop_rules,
    best_regime: body.best_regime,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
