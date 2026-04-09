'use client';

import type { DatasetResponse } from '@/lib/types';

type Props = {
  data: DatasetResponse;
  networkError: string | null;
};

// Читає стан з API-відповіді + стан мережі і показує кольоровий бейдж.
// Вся "логіка відображення стану" зібрана тут - нікуди інше цю логіку
// розповзатись не треба. Додаси новий стан — міняєш один компонент.

export function FreshnessBadge({ data, networkError }: Props) {
  // Якщо взагалі не можемо достукатись до API - це окремий випадок,
  // який вищий за будь-який freshness з сервера.
  if (networkError) {
    return (
      <Badge color="red" title="Connection issue">
        Cannot reach API: {networkError}. Showing cached data.
      </Badge>
    );
  }

  const { freshness, refresh, snapshot } = data;

  switch (freshness) {
    case 'fresh':
      return (
        <Badge color="green" title="Up to date">
          Data fresh · updated {formatAge(snapshot?.ageSeconds ?? 0)} ago
        </Badge>
      );

    case 'stale':
      return (
        <Badge color="amber" title="Retrying">
          Data stale · refresh in progress
          {refresh.status === 'retrying' && (
            <> · attempt {refresh.attempt}</>
          )}
          {snapshot && <> · last updated {formatAge(snapshot.ageSeconds)} ago</>}
        </Badge>
      );

    case 'failed':
      return (
        <Badge color="red" title="Refresh failed">
          Refresh failed after {refresh.attempt} attempts
          {snapshot && <> · showing data from {formatAge(snapshot.ageSeconds)} ago</>}
          {refresh.lastError && <> · {refresh.lastError}</>}
        </Badge>
      );

    case 'no_data':
      return (
        <Badge color="gray" title="No data yet">
          No snapshots yet · worker has not run successfully
        </Badge>
      );
  }
}

// Маленький внутрішній компонент, щоб не дублювати розмітку бейджа.
function Badge({
  color,
  title,
  children,
}: {
  color: 'green' | 'amber' | 'red' | 'gray';
  title: string;
  children: React.ReactNode;
}) {
  const colorClasses = {
    green: 'bg-green-100 text-green-900 border-green-300',
    amber: 'bg-amber-100 text-amber-900 border-amber-300',
    red:   'bg-red-100 text-red-900 border-red-300',
    gray:  'bg-gray-100 text-gray-800 border-gray-300',
  };

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${colorClasses[color]}`}
      title={title}
    >
      <span className="h-2 w-2 rounded-full bg-current opacity-60" />
      {children}
    </div>
  );
}

// Перетворює секунди на людський рядок: "5s", "2m", "1h 3m"
function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}