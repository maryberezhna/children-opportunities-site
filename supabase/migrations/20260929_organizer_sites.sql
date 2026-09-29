-- Сайти організаторів конкурсів і програм для підлітків — одне джерело, один рядок (29.09.2026).
--
-- Навіщо: автоматичний пошук майже нічого нового не приносив (Марія,
-- 28.09.2026). Дивимось туди, де оголошення зʼявляються вперше. Перевірено
-- ~70 доменів; лишились ці пʼять. Скрапер — scraper/scrapers/organizer_sites.py.
-- Щотижня (pin_interval, 7 днів), як сайти діаспори. Країни й міста за
-- замовчуванням немає свідомо: частина новин лише для Києва, місце бере модель.
-- trust_tier 2: це самі організатори, не агрегатори.

insert into public.sources
  (name, pipeline, adapter, enabled, trust_tier, config, categories, notes,
   crawl_interval_days, pin_interval, next_crawl_at)
values
  ('Мала академія наук — новини (man.gov.ua)', 'python', 'html', true, 2,
   '{"module": "organizer_sites", "site": "man-news", "url": "https://man.gov.ua/about/news"}',
   '{konkursy,osvita}',
   'Новини МАН: старти сезонів GENIUS Olympiad, ISEF Ukraine, спільні програми. Новини про вчителів і саму МАН відсіюються за заголовком.',
   7, true, now()),
  ('Мала академія наук — події (man.gov.ua)', 'python', 'html', true, 2,
   '{"module": "organizer_sites", "site": "man-events", "url": "https://man.gov.ua/"}',
   '{konkursy,osvita}',
   'Події МАН з головної (/events без посилань у HTML): школи, конкурси, хакатони. Події для педагогів, лекції, форуми відсіюються за заголовком.',
   7, true, now()),
  ('Київська Мала академія наук (kman.kyiv.ua)', 'python', 'html', true, 2,
   '{"module": "organizer_sites", "site": "kman", "url": "https://kman.kyiv.ua/ua/novyny/"}',
   '{konkursy,osvita}',
   'Новини Київської МАН: частина всеукраїнська (ISEF), частина лише для Києва — місце визначає модель.',
   7, true, now()),
  ('Klitschko Foundation (klitschkofoundation.org)', 'python', 'html', true, 2,
   '{"module": "organizer_sites", "site": "klitschko", "url": "https://klitschkofoundation.org/news/"}',
   '{mizhnarodni,osvita}',
   'Перелік новин (WP REST 401, RSS мертвий): набори на програми для підлітків. Звіти про завершене відсіюються за заголовком.',
   7, true, now()),
  ('Український державний центр національно-патріотичного виховання (udcnpvctum.kyiv.ua)', 'python', 'rss', true, 2,
   '{"module": "organizer_sites", "site": "udcnpv", "url": "https://udcnpvctum.kyiv.ua/feed/"}',
   '{konkursy}',
   'RSS; сезонне (березень–травень): Джура, конкурс екскурсоводів шкільних музеїв, учнівські конференції.',
   7, true, now())
on conflict (name) do nothing;
