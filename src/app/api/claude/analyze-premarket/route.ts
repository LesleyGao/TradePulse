import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { analyzePremarket } from '@/lib/claude';
import { calculateStats } from '@/lib/stats-calculator';
import type { Trade, PremarketInput } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body = await request.json() as PremarketInput;
  const supabase = await createSupabaseServerClient();

  // Get historical stats for context
  const { data: allTrades } = await supabase
    .from('trades').select('*').eq('is_open', false).order('entry_time', { ascending: true });
  const stats = (allTrades && allTrades.length > 0) ? calculateStats(allTrades as Trade[]) : null;

  // Get today's trade count and P/L
  const { data: todayTrades } = await supabase
    .from('trades').select('*').eq('date', body.date);
  const todayPnl = (todayTrades || []).reduce((s: number, t: Trade) => s + (t.pnl_dollar ?? 0), 0);

  try {
    const result = await analyzePremarket(body, stats, (todayTrades || []).length, todayPnl);
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 500 });
  }
}
