import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const type = (formData.get('type') as string) || 'gex';
  const date = (formData.get('date') as string) || new Date().toISOString().slice(0, 10);

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'png';
  const filename = `${type}/${date}/${type}-${Date.now()}.${ext}`;
  const bucket = type === 'chart' ? 'chart-screenshots' : 'gex-screenshots';

  const { error } = await supabase.storage.from(bucket).upload(filename, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filename);
  return NextResponse.json({ data: { path: urlData.publicUrl, filename } }, { status: 201 });
}
