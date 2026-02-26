import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { analyzeEdge } from '@/lib/claude';
import type { Trade, EdgeRefinement } from '@/lib/types';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const body = await request.json();
  const triggerType = body.triggerType || 'manual';

  // Get all closed trades
  const { data: trades } = await supabase
    .from('trades').select('*').eq('is_open', false).order('entry_time', { ascending: true });
  if (!trades || trades.length < 5) {
    return NextResponse.json({ error: 'Need at least 5 trades for edge analysis' }, { status: 400 });
  }

  // Get previous report for comparison
  const { data: prevReport } = await supabase
    .from('edge_refinements').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();

  try {
    const tradeHistory = (trades as Trade[]).map(t => ({
      date: t.date,
      strike: t.strike,
      callPut: t.call_put,
      side: t.side,
      setupType: t.setup_type || 'Unknown',
      regime: t.regime || 'Unknown',
      entryPrice: t.entry_price,
      exitPrice: t.exit_price ?? 0,
      pnlDollar: t.pnl_dollar ?? 0,
      pnlPercent: t.pnl_percent ?? 0,
      holdingMinutes: t.holding_minutes ?? 0,
      entryTime: t.entry_time,
    }));

    const result = await analyzeEdge(tradeHistory, (prevReport as EdgeRefinement | null)?.findings);

    // Save to database
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from('edge_refinements').insert({
      trade_count: trades.length,
      analysis_date: today,
      trigger_type: triggerType,
      findings: JSON.stringify(result),
      setup_recommendations: JSON.stringify((result as Record<string, unknown>).setupRecommendations || []),
      strongest_edges: JSON.stringify((result as Record<string, unknown>).strongestEdges || []),
      weakest_edges: JSON.stringify((result as Record<string, unknown>).weakestEdges || []),
      concrete_change: (result as Record<string, unknown>).concreteChange || null,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 500 });
  }
}
