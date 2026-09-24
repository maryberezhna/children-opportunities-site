-- Скільки токенів з'їв кожен процес — у базі, а не в логах Actions.
--
-- Навіщо. 23.09.2026 на питання «де паляться токени» довелось відповідати
-- оцінками: лічильники були лише в екстракції і друкувались у stdout GitHub
-- Actions, який зникає. Процеси на Sonnet (агент пошуку, розвідник джерел,
-- триаж карантину, обробка нотаток) не рахували нічого.
--
-- Один рядок = доба × процес × модель. Кілька запусків на добу складаються
-- (personal-digest і deadline-reminders мають по три cron-записи).
-- cost_usd рахує scraper/usage.py за прайсом Anthropic; це наша оцінка, а не
-- рахунок Anthropic — розбіжність у кілька відсотків нормальна.

create table if not exists public.llm_usage (
  id                  uuid primary key default gen_random_uuid(),
  day                 date not null,
  workflow            text not null,
  model               text not null,
  calls               integer not null default 0,
  input_tokens        bigint  not null default 0,   -- без кешу, повна ціна
  cache_read_tokens   bigint  not null default 0,   -- 10% ціни
  cache_write_tokens  bigint  not null default 0,   -- 125% ціни
  output_tokens       bigint  not null default 0,
  cost_usd            numeric(12, 6) not null default 0,
  created_at          timestamptz not null default now(),
  unique (day, workflow, model)
);

create index if not exists llm_usage_day_idx on public.llm_usage (day desc);

alter table public.llm_usage enable row level security;

-- Читає й пише лише сервісна роль (конвеєр і адмінка). Анонімний ключ сюди
-- не ходить: витрати — не публічні дані.
drop policy if exists "llm_usage service only" on public.llm_usage;
create policy "llm_usage service only" on public.llm_usage
  for all to service_role using (true) with check (true);
