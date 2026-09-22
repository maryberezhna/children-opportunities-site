-- Цитати на пʼять обовʼязкових полів (світлофор, рішення Марії 22.09.2026):
-- запис зелений лише тоді, коли на кожне поле є дослівна цитата зі сторінки.
-- Ключі — з lib/publish-criteria.json (age, date, cost, type, place).
-- Порожній обʼєкт = жодного доказу: так виглядають усі записи до 22.09.2026.
alter table public.opportunities
  add column if not exists evidence jsonb not null default '{}'::jsonb;
comment on column public.opportunities.evidence is
  'Дослівні цитати зі сторінки джерела на обовʼязкові поля: {age, date, cost, type, place}. Ключі — lib/publish-criteria.json. Порожньо = поле без доказу.';
