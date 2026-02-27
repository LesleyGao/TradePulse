import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('trades')
    .select('date')
    .or('thesis.neq.,key_learning.neq.,what_went_right.neq.,what_went_wrong.neq.');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Extract unique dates
  const dates = [...new Set((data ?? []).map((row: { date: string }) => row.date))];
  return NextResponse.json({ dates });
}
