import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/datasets — повертає список усіх датасетів з їх поточним станом.
export async function GET() {
  // 1. Всі датасети
  const { data: datasets, error: dsErr } = await supabaseAdmin
    .from('datasets')
    .select('id, name, refresh_interval_sec, chart_config')
    .order('name');

  if (dsErr || !datasets) {
    return NextResponse.json({ error: 'Failed to load datasets' }, { status: 500 });
  }

  // 2. Для кожного — тягнемо snapshot і останній job паралельно.
  const enriched = await Promise.all(
    datasets.map(async (ds) => {
      const [snapshotRes, jobRes] = await Promise.all([
        supabaseAdmin
          .from('snapshots')
          .select('data, row_count, fetched_at')
          .eq('dataset_id', ds.id)
          .eq('is_current', true)
          .maybeSingle(),
        supabaseAdmin
          .from('refresh_jobs')
          .select('status, attempt, next_retry_at, error_message')
          .eq('dataset_id', ds.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const snapshot = snapshotRes.data;
      const lastJob = jobRes.data;

      const now = Date.now();
      const fetchedAtMs = snapshot ? new Date(snapshot.fetched_at).getTime() : 0;
      const ageSec = snapshot ? Math.floor((now - fetchedAtMs) / 1000) : Infinity;

      const staleThreshold = ds.refresh_interval_sec * 2;

      let freshness: 'fresh' | 'stale' | 'failed' | 'no_data';

      if (!snapshot) freshness = 'no_data';
      else if (lastJob?.status === 'failed') freshness = 'failed';
      else if (ageSec > staleThreshold || lastJob?.status === 'retrying') freshness = 'stale';
      else freshness = 'fresh';

      return {
        dataset: {
          id: ds.id,
          name: ds.name,
          chartConfig: ds.chart_config,
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
      };
    })
  );

  return NextResponse.json({ datasets: enriched });
}