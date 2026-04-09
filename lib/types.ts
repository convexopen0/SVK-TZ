export type Freshness = 'fresh' | 'stale' | 'failed' | 'no_data';

export type RefreshStatus = 
  | 'never_run' 
  | 'running' 
  | 'success' 
  | 'retrying' 
  | 'failed';

export type DataRow = Record<string, unknown>;

// Конфіг для рендеру графіка, береться з datasets.chart_config у БД
export type ChartConfig = {
  chartType: 'bar'; // на майбутнє — 'line' | 'pie' | ...
  labelField: string;
  valueField: string;
  title: string;
  color: string;
};

export type DatasetView = {
  dataset: {
    id: string;
    name: string;
    chartConfig: ChartConfig | null;
  };
  snapshot: {
    rows: DataRow[];
    rowCount: number;
    fetchedAt: string;
    ageSeconds: number;
  } | null;
  refresh: {
    status: RefreshStatus;
    attempt: number;
    nextRetryAt: string | null;
    lastError: string | null;
  };
  freshness: Freshness;
};

// Відповідь list-endpoint
export type DatasetsListResponse = {
  datasets: DatasetView[];
};