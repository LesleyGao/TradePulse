import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const body = await request.json();

  const fields = Object.keys(body).filter(k => k !== 'id');
  if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const updateObj: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of fields) updateObj[f] = body[f];

  const { error } = await supabase.from('setups').update(updateObj).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: row } = await supabase.from('setups').select('*').eq('id', id).single();
  return NextResponse.json({ data: row });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  // Soft delete
  const { error } = await supabase
    .from('setups')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
