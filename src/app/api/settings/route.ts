import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/rule-checker';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const settings = await getSettings(supabase);
  return NextResponse.json({ data: settings });
}

export async function PUT(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const body = await request.json();

  const keyMap: Record<string, string> = {
    dailyLossLimit: 'daily_loss_limit',
    maxTradesPerDay: 'max_trades_per_day',
    tradingWindowStart: 'trading_window_start',
    tradingWindowEnd: 'trading_window_end',
    defaultTimezone: 'default_timezone',
  };

  const entries = Object.entries(body)
    .filter(([k]) => keyMap[k])
    .map(([k, v]) => [keyMap[k], String(v)] as [string, string]);

  for (const [key, value] of entries) {
    await supabase.from('settings').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  }

  const settings = await getSettings(supabase);
  return NextResponse.json({ data: settings });
}
