'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { DatasetView } from '@/lib/types';

export function DataChart({ view }: { view: DatasetView }) {
  const { dataset, snapshot } = view;
  const config = dataset.chartConfig;

  // Якщо даних ще немає, показуємо заглушку, а не кидаємо помилку
  if (!config || !snapshot || !snapshot.rows) {
    return <div className="flex h-full items-center justify-center text-slate-500">Немає даних для графіка</div>;
  }

  // Обробка даних: замість старого prepareChartData ми динамічно читаємо конфіг
  const chartData = snapshot.rows.map(row => ({
    ...row,
    [config.labelField]: row[config.labelField],
    [config.valueField]: Number(row[config.valueField]) || 0
  }));

  return (
    <div className="h-[300px] w-full mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.3} />
          <XAxis dataKey={config.labelField} stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-45} textAnchor="end" height={60} />
          <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }} 
            itemStyle={{ color: config.color }} 
            cursor={{ fill: '#1e293b', opacity: 0.4 }} 
          />
          <Bar dataKey={config.valueField} fill={config.color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}