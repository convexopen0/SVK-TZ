'use client';
import { useEffect, useState } from 'react';
import type { DatasetsListResponse, DatasetView } from './types';

export function useAllDatasets(intervalMs = 10_000) {
  const [data, setData] = useState<DatasetView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const res = await fetch('/api/datasets');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: DatasetsListResponse = await res.json();
        
        if (!cancelled) {
          setData(json.datasets);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Помилка мережі');
        }
      }
    }

    fetchOnce();
    const interval = setInterval(fetchOnce, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [intervalMs]);

  return { data, error };
}