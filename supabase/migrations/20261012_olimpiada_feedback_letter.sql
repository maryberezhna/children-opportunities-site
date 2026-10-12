-- Лист через тиждень після диплома «розкажіть про ваш досвід пошуку
-- можливостей для дитини» (Марія, 12.10.2026). Один лист на адресу:
-- scraper/olimpiada_invites.py ставить мітку всім заявкам цієї адреси.
alter table public.olimpiada_entries
  add column if not exists feedback_sent_at timestamptz;

comment on column public.olimpiada_entries.feedback_sent_at is 'Коли на адресу батьків пішов лист-питання «розкажіть про ваш досвід» (через 7 днів після диплома; один на адресу).';
