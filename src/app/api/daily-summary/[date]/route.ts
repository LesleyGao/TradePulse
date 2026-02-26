import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('daily_summaries').select('*').eq('date', date).maybeSingle();
  return NextResponse.json({ data: data || null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const supabase = await createSupabaseServerClient();
  const body = await request.json();

  const fields = Object.keys(body).filter(k => k !== 'id' && k !== 'date');
  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const updateObj: Record<string, unknown> = {};
  for (const f of fields) updateObj[f] = body[f];

  const { error } = await supabase.from('daily_summaries').update(updateObj).eq('date', date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: row } = await supabase.from('daily_summaries').select('*').eq('date', date).maybeSingle();
  return NextResponse.json({ data: row });
}
