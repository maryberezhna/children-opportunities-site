-- ПриватБанк як джерело-організатор (16.10.2026).
--
-- Марія: «додай як партнера ПриватБанк, бо вони багато роблять для дітей».
-- Пропустили JuniorS Games 2026 (8 міст, понад 40 000 гостей; анонс на
-- privatbank.ua ще 24.06.2026) — ні сайту банку, ні @juniors_in_ua у джерелах
-- не було. Скрапер — scraper/scrapers/organizer_sites.py (ключ privatbank);
-- новини не про дітей відсіюються за заголовком ще до моделі.
-- trust_tier 1: банк — сам організатор/генеральний партнер програм, не агрегатор.

insert into public.sources
  (name, pipeline, adapter, enabled, trust_tier, config, categories, notes,
   crawl_interval_days, pin_interval, next_crawl_at)
values
  ('ПриватБанк — новини (privatbank.ua)', 'python', 'html', true, 1,
   '{"module": "organizer_sites", "site": "privatbank", "url": "https://privatbank.ua/news/archive"}',
   '{konkursy,osvita}',
   'Партнер-організатор дитячих і студентських програм: ПриватКампус, JuniorS Games, Картка Юніора, фінансова грамотність. До моделі йдуть лише заголовки про дітей, школярів, студентів, молодь.',
   7, true, now())
on conflict (name) do nothing;
