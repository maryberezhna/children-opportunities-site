-- Сайти організацій діаспори — одне джерело, один рядок (28.09.2026).
--
-- Напрям «Діаспора»: діти з України, які вже живуть за кордоном. Дев'ять
-- сайтів перевірено живцем 28.09.2026; скрапер — scraper/scrapers/diaspora_sites.py.
--
-- • pin_interval + crawl_interval_days = 7: обхід щотижня, незалежно від
--   знахідок і сезону (сайти оновлюються рідко). Семантику pin_interval
--   розширено в scraper/db.py: закріплений ритм = crawl_interval_days
--   (у всіх наявних закріплених рядків він 1 — для них нічого не змінилось).
-- • config.default_countries / default_city: main.py підставляє їх, коли
--   модель не назвала місця, а участь не онлайн. У текст сирцю країну не
--   дописуємо — наш рядок став би «цитатою сторінки» для воріт правди.
-- • trust_tier 2: це самі організатори, не агрегатори.

insert into public.sources
  (name, pipeline, adapter, enabled, trust_tier, config, categories, notes,
   crawl_interval_days, pin_interval, next_crawl_at)
values
  ('Український кризовий центр в Ірландії (ucci.ie)', 'python', 'api', true, 2,
   '{"module": "diaspora_sites", "site": "ucci", "url": "https://ucci.ie/", "default_countries": ["ie"], "default_city": "Дублін"}',
   '{osvita,talanty,tabory}',
   'WP REST: our-projects (курси, студії, суботня школа), events, posts + тижневий календар /kalendar/. Уроки всередині SCHOOL UCCI KIDS — частина школи, окремо не беремо.',
   7, true, now()),
  ('Український дім у Дрездені (plattform-dresden.de)', 'python', 'api', true, 2,
   '{"module": "diaspora_sites", "site": "dresden", "url": "https://plattform-dresden.de/", "default_countries": ["de"], "default_city": "Дрезден"}',
   '{osvita,talanty}',
   'WP REST posts за 30 днів, німецькою. Більшість подій для дорослих — у модель лише з дитячою ознакою.',
   7, true, now()),
  ('Український центр «Осередок» у Лейпцигу (oseredok-leipzig.de)', 'python', 'api', true, 2,
   '{"module": "diaspora_sites", "site": "oseredok", "url": "https://oseredok-leipzig.de/", "default_countries": ["de"], "default_city": "Лейпциг"}',
   '{osvita,talanty}',
   'WP REST mec-events, українська версія (lang=uk): гуртки для дітей/підлітків + інші події з дитячою ознакою; вік, ціна й розклад — зі сторінки події.',
   7, true, now()),
  ('Художня школа Ростока (kunstschule-rostock.de)', 'python', 'html', true, 2,
   '{"module": "diaspora_sites", "site": "rostock", "url": "https://www.kunstschule-rostock.de/kurse", "default_countries": ["de"], "default_city": "Росток"}',
   '{talanty}',
   'Лише курси «für ukrainische Kinder» з переліків за віком; решта курсів школи — місцеві, не наші.',
   7, true, now()),
  ('Об''єднання українців у Польщі (ukraincy.org.pl)', 'python', 'api', true, 2,
   '{"module": "diaspora_sites", "site": "zuwp", "url": "https://ukraincy.org.pl/", "default_countries": ["pl"]}',
   '{talanty,konkursy}',
   'WP REST posts за 180 днів, польською: кілька дитячих фестивалів і конкурсів на рік.',
   7, true, now()),
  ('Вроцлавсько-Кошалінська єпархія УГКЦ (cerkiew.net.pl)', 'python', 'rss', true, 2,
   '{"module": "diaspora_sites", "site": "cerkiew", "url": "https://cerkiew.net.pl/", "default_countries": ["pl"]}',
   '{tabory}',
   'REST закритий (401) — стрічка «Життя єпархії» (2 сторінки) і пошукові стрічки «табір»/«obóz». Богословські рубрики відсіюються за заголовком.',
   7, true, now()),
  ('Асоціація «Берегиня», Барселона (beregynia.info)', 'python', 'html', true, 2,
   '{"module": "diaspora_sites", "site": "beregynia", "url": "https://www.beregynia.info/", "default_countries": ["es"], "default_city": "Барселона"}',
   '{konkursy,osvita,talanty}',
   'Google Sites без стрічки — сторінки: конкурс «Диво-вишиванка», школа «Мрія», школа мистецтв «Сузір''я».',
   7, true, now()),
  ('Українська суботня школа «Рідна школа», Чехія (ridnashkola.cz)', 'python', 'html', true, 2,
   '{"module": "diaspora_sites", "site": "ridna-shkola-cz", "url": "https://www.ridnashkola.cz/", "default_countries": ["cz"]}',
   '{osvita}',
   'Google Sites: головна (реєстрація, ціни, Прага/Острава/Їглава) + розклад — одна картка на школу.',
   7, true, now()),
  ('Українська школа «Джерело», Амстердам (ukrainianschool.nl)', 'python', 'html', true, 2,
   '{"module": "diaspora_sites", "site": "dzherelo-nl", "url": "https://ukrainianschool.nl/", "default_countries": ["nl"], "default_city": "Амстердам"}',
   '{osvita}',
   'Сторінки «Інформація для батьків», «Вартість навчання», «Календар на семестр», «Приєднатися» — одна картка на школу.',
   7, true, now())
on conflict (name) do nothing;
