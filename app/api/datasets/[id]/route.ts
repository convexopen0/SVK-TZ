import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/datasets/:id
// Повертає поточний snapshot + метадані про свіжість/стан.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // У Next.js 15 params — Promise, треба await
  const { id: datasetId } = await params;

  // 1. Тягнемо сам датасет (для назви та інтервалу оновлення)
  const { data: dataset, error: dsErr } = await supabaseAdmin
    .from('datasets')
    .select('id, name, refresh_interval_sec, max_retries')
    .eq('id', datasetId)
    .single();

  if (dsErr || !dataset) {
    return NextResponse.json(
      { error: 'Dataset not found' },
      { status: 404 }
    );
  }

  // 2. Поточний snapshot (is_current = true)
  const { data: snapshot } = await supabaseAdmin
    .from('snapshots')
    .select('id, data, row_count, fetched_at')
    .eq('dataset_id', datasetId)
    .eq('is_current', true)
    .maybeSingle();

  // 3. Останній job — для статусу refresh'а
  const { data: lastJob } = await supabaseAdmin
    .from('refresh_jobs')
    .select('status, attempt, next_retry_at, error_message, started_at')
    .eq('dataset_id', datasetId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 4. Рахуємо вік снепшота і визначаємо "freshness status"
  // Це серце логіки: тут ми перетворюємо стан БД у стан для UI
  const now = Date.now();
  const fetchedAtMs = snapshot ? new Date(snapshot.fetched_at).getTime() : 0;
  const ageSec = snapshot ? Math.floor((now - fetchedAtMs) / 1000) : Infinity;

  // Поріг застарілості: 2x від refresh_interval_sec.
  // Якщо інтервал 60с, а даним вже 130с — значить worker двічі не впорався.
  const staleThreshold = dataset.refresh_interval_sec * 2;

  let freshness: 'fresh' | 'stale' | 'failed' | 'no_data';

  if (!snapshot) {
    freshness = 'no_data';
  } else if (lastJob?.status === 'failed') {
    freshness = 'failed';
  } else if (ageSec > staleThreshold || lastJob?.status === 'retrying') {
    freshness = 'stale';
  } else {
    freshness = 'fresh';
  }

  return NextResponse.json({
    dataset: {
      id: dataset.id,
      name: dataset.name,
    },
    snapshot: snapshot
      ? {
          rows: snapshot.data,
          rowCount: snapshot.row_count,
          fetchedAt: snapshot.fetched_at,
          ageSeconds: ageSec,
        }
      : null,
    refresh: {
      status: lastJob?.status ?? 'never_run',
      attempt: lastJob?.attempt ?? 0,
      nextRetryAt: lastJob?.next_retry_at ?? null,
      lastError: lastJob?.error_message ?? null,
    },
    freshness,
  });
}