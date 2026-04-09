-- =====================================================
-- Dashboard Prototype — Database Schema
-- =====================================================

-- Tables
create table datasets (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  source_type          text not null check (source_type in ('gsheet', 'sql')),
  source_config        jsonb not null,
  refresh_interval_sec int not null default 300,
  max_retries          int not null default 5,
  chart_config         jsonb,
  created_at           timestamptz not null default now()
);

create table snapshots (
  id          uuid primary key default gen_random_uuid(),
  dataset_id  uuid not null references datasets(id) on delete cascade,
  data        jsonb not null,
  row_count   int not null,
  fetched_at  timestamptz not null default now(),
  is_current  boolean not null default false
);

create index idx_snapshots_current on snapshots(dataset_id) where is_current = true;

create table refresh_jobs (
  id            uuid primary key default gen_random_uuid(),
  dataset_id    uuid not null references datasets(id) on delete cascade,
  status        text not null check (status in ('running', 'success', 'failed', 'retrying')),
  attempt       int not null default 1,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  next_retry_at timestamptz,
  error_message text,
  snapshot_id   uuid references snapshots(id)
);

create index idx_jobs_dataset_recent on refresh_jobs(dataset_id, started_at desc);

-- Function: returns datasets that need refresh
create or replace function datasets_due_for_refresh()
returns table (
  dataset_id      uuid,
  name            text,
  source_type     text,
  source_config   jsonb,
  max_retries     int,
  reason          text,
  pending_job_id  uuid,
  pending_attempt int
)
language sql
as $$
  select d.id, d.name, d.source_type, d.source_config, d.max_retries,
    case when s.id is null then 'never_fetched' else 'stale' end as reason,
    null::uuid, null::int
  from datasets d
  left join snapshots s on s.dataset_id = d.id and s.is_current = true
  where not exists (
    select 1 from refresh_jobs j
    where j.dataset_id = d.id and j.status in ('running', 'retrying')
  )
  and (s.id is null or s.fetched_at < now() - (d.refresh_interval_sec || ' seconds')::interval)

  union all

  select d.id, d.name, d.source_type, d.source_config, d.max_retries,
    'retry_due', j.id, j.attempt
  from datasets d
  join refresh_jobs j on j.dataset_id = d.id
  where j.status = 'retrying' and j.next_retry_at <= now();
$$;

-- =====================================================
-- Seed: example datasets
-- =====================================================

insert into datasets (name, source_type, source_config, refresh_interval_sec, chart_config)
values 
(
  'Roma 23/24',
  'gsheet',
  '{"spreadsheet_id": "<your-sheet-id>", "sheet_name": "season23/24"}'::jsonb,
  60,
  '{"chartType":"bar","labelField":"Player","valueField":"Goals Scored","title":"Goals by player","color":"#8b1818"}'::jsonb
),
(
  'Demo sales by region',
  'sql',
  '{"query": "select region, sum(revenue) as total_revenue from demo_sales group by region order by total_revenue desc"}'::jsonb,
  60,
  '{"chartType":"bar","labelField":"region","valueField":"total_revenue","title":"Revenue by region","color":"#1e5f8b"}'::jsonb
);

-- Demo SQL source table
create table demo_sales (
  id serial primary key,
  region text not null,
  product text not null,
  revenue numeric not null,
  created_at timestamptz default now()
);

insert into demo_sales (region, product, revenue) values
  ('EU', 'EpicFlow Pro', 45000),
  ('US', 'EpicFlow Pro', 62000),
  ('EU', 'EpicFlow Starter', 18000),
  ('US', 'EpicFlow Starter', 23000),
  ('APAC', 'EpicFlow Pro', 31000),
  ('APAC', 'EpicFlow Starter', 12000);