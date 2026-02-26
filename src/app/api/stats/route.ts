import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { calculateStats } from '@/lib/stats-calculator';
import type { Trade } from '@/lib/types';

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = request.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase.from('trades').select('*').eq('is_open', false);

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query.order('entry_time', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const stats = calculateStats((data || []) as Trade[]);
  return NextResponse.json({ data: stats });
}
