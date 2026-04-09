'use client';
import { useAllDatasets } from '@/lib/useDatasets';
import { DataChart } from '@/components/DataChart';

export default function HomePage() {
  // Використовуємо наш новий хук, який тягне ВСІ датасети
  const { data: datasets, error } = useAllDatasets();

  // Обробка стану: помилка
  if (error) {
    return (
      <main className="p-10 text-red-400 bg-slate-950 h-screen font-mono flex items-center justify-center">
        Помилка: {error}
      </main>
    );
  }

  // Обробка стану: завантаження
  if (!datasets) {
    return (
      <main className="p-10 text-slate-400 bg-slate-950 h-screen font-mono flex items-center justify-center">
        Завантаження радарів...
      </main>
    );
  }

  // Допоміжна функція для кольорів статусу
  const getBadgeStyle = (freshness: string) => {
    switch (freshness) {
      case 'fresh': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'stale': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  // Рендер: сітка з усіма нашими графіками
  return (
    <main className="min-h-screen bg-slate-950 p-6 md:p-12 font-sans text-slate-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header>
          <h1 className="text-4xl font-black tracking-tight text-white">AI Data Orchestrator</h1>
          <p className="text-slate-400 mt-2">Мульти-датасет моніторинг. Всі дані оновлюються автоматично.</p>
        </header>

        {/* Сітка карток */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {datasets.map((view) => (
            <div key={view.dataset.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col">
              
              {/* Шапка картки з бейджиком */}
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {view.dataset.chartConfig?.title || view.dataset.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    ID: {view.dataset.id.split('-')[0]}...
                  </p>
                </div>
                
                <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${getBadgeStyle(view.freshness)}`}>
                  <span className={`w-2 h-2 rounded-full ${view.freshness === 'fresh' ? 'bg-green-400 animate-pulse' : view.freshness === 'stale' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                  {view.freshness}
                </div>
              </div>

              {/* Сам Графік */}
              <div className="flex-grow mt-2">
                <DataChart view={view} />
              </div>

              {/* Метадані під графіком */}
              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500 font-mono">
                <span>Рядків: {view.snapshot?.rowCount || 0}</span>
                <span>Оновлено: {view.snapshot ? new Date(view.snapshot.fetchedAt).toLocaleTimeString() : 'Ніколи'}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}