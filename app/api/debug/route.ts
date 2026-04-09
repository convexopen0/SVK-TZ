import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  // 1. Перевіряємо чи змінні оточення взагалі видно
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 2. Пробуємо зробити простий select з таблиці datasets
  const { data, error } = await supabaseAdmin
    .from('datasets')
    .select('*');

  // 3. Повертаємо все в одному JSON для діагностики
  return NextResponse.json({
    env: {
      url: url ?? 'UNDEFINED',
      hasKey: !!key,
      keyPrefix: key ? key.slice(0, 15) : 'UNDEFINED',
    },
    query: {
      data,
      error,
      rowCount: data?.length ?? 0,
    },
  });
}