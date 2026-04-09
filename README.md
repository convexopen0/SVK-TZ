# Dashboard Prototype — Persistent Data Layer

Прототип альтернативи Looker Studio, який ніколи не показує "помилку завантаження" замість графіків. Дані кешуються в перехідній БД, при падінні джерела фоновий worker ретраїть з експоненційним backoff, користувач продовжує бачити останній вдалий снепшот разом зі статусом оновлення.

Дашборд показує два датасети одночасно — один з Google Sheets, один з PostgreSQL (демо-таблиця sales by region). Обидва обслуговуються тим самим worker-ом і тим самим UI.


## Architecture
**Worker (n8n)** — тягне дані з джерел, ретраїть при падінні, пише в Supabase.
**Cache (Supabase Postgres)** — три таблиці: `datasets` (конфіг), `snapshots` (дані), `refresh_jobs` (стан спроб).
**API (Next.js routes)** — читає тільки з кешу, обчислює freshness state.
**UI (React)** — polling кожні 10с, показує бейдж стану + графік. Ніколи не зникає.

## Planning (per task brief)

### Final result
Веб-дашборд з графіками, який показує дані з різних джерел і не зникає при їх падінні. Worker фоново оновлює дані з ретраями і алертами.

### Stages
1. **Schema design** — три таблиці + SQL-функція для пошуку датасетів які треба оновити.
2. **Worker** — n8n workflow з expo-backoff retry, persistent state в БД, error handling, Telegram alerts.
3. **API layer** — Next.js routes що читають кеш і рахують freshness без логіки оновлень.
4. **Frontend** — React сторінка з polling, multi-dataset render, freshness badges.
5. **Testing** — три ручних сценарії: happy path, fail з retry, recovery.

### Tools and rationale

| Tool | Why |
|---|---|
| **n8n** | Production-grade scheduler з візуальним workflow і вбудованими коннекторами до GSheets/Postgres. Альтернатива (Node + cron) — швидше для одного процесу, гірше масштабується і потребує власної інфраструктури моніторингу. n8n дає це з коробки. |
| **Supabase Postgres** | Готова інфраструктура, JSONB для гнучкого зберігання даних різної форми, не треба піднімати окрему БД. |
| **Next.js 15 (App Router)** | Frontend і API в одному проекті, один deploy. App Router для серверних API routes без окремого backend-сервера. |
| **TypeScript** | Типобезпека між API і фронтом, особливо критична для freshness-стейтів — exhaustive switch ловить незакриті кейси на етапі компіляції. |
| **Recharts** | Швидкий старт з графіками, параметризується через chart_config з БД. |
| **Tailwind** | Стилі без окремих файлів, швидка ітерація. |

### Testing
Три ручних сценарії, що покривають критичні шляхи:
1. **Happy path** — джерело валідне, worker оновлює дані, бейдж "fresh".
2. **Source failure** — навмисно ламаємо source_config, дивимось як worker ретраїть (attempt 1→2→3→4→5), бейдж стає "stale" а потім "failed", прилітає Telegram. Графік весь час на місці.
3. **Recovery** — повертаємо валідний source_config, worker автоматично відновлює, бейдж знову "fresh".

## Key design decisions

### Snapshot model, not row-level upsert
Кожне успішне оновлення = новий рядок у `snapshots` з `is_current=true`, попередній маркується false. Дає атомарність (UI не бачить half-updated state), історію для аналізу, можливість rollback.

### State lives in DB, not in worker
Лічильник спроб, `next_retry_at`, error message — все в `refresh_jobs`, не в пам'яті n8n. Це означає: можна перезапустити n8n або додати другий інстанс — retry-лічильник не загубиться.

### Worker fetch isolated from UI
UI ніколи не звертається до джерел напряму, тільки до кеш-БД. Це і є фундамент graceful degradation: фронт фізично не може побачити "broken" state джерела.

### Branch duplication for gsheet/sql instead of merging
У worker дві паралельні гілки (gsheet → normalize → write_snapshot → mark_success, sql → ...). Спершу спробував зливати в одну ноду normalize — items з різних source_type змішувались в один масив, дані одного датасета писались під id іншого. Дублювання гілок — простіший і надійніший підхід для прототипу. У production винесено б у sub-workflow з параметризацією.

### Exponential backoff 30s → 480s
Стандартна практика: між спробами час росте, щоб не добивати джерело що і так лежить. 5 спроб дають ~16 хвилин загального вікна — достатньо для коротких збоїв джерела, але не настільки довго щоб маскувати реальні проблеми.


## Failure scenarios — what user sees

| Scenario | Worker | UI |
|---|---|---|
| Все працює | `success` | 🟢 Fresh, дані оновлюються кожні N секунд |
| Джерело впало (1-4 спроба) | `retrying`, attempt counter росте | 🟡 Stale, графік на місці |
| Вичерпали всі ретраї | `failed`, Telegram алерт | 🔴 Failed + last error, графік **все ще на місці** |
| Джерело повернулось | новий `success` | 🟢 Fresh, автоматично без втручання |

Графік не зникає **в жодному з цих станів**.



