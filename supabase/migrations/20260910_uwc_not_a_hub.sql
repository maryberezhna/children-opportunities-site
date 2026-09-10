-- Три причини дублів і хибних карток, знайдені 10.09.2026. Кожна окремо.
--
-- ── 1. Сторінка подачі UWC — це ОДНА програма, а не хаб ──────────────────
--
-- Таблиця dedup_hub_urls вимикає охоронця дублів для адрес, де на одному URL
-- справді живе багато різних можливостей: перелік олімпіад МОН, каталог
-- курсів Дія.Освіта, афіша фестивалів. Для таких сторінок збіг canonical_url
-- нічого не означає, і блокувати другий запис не можна.
--
-- https://ukraine.uwc.org/apply туди потрапила помилково — найпевніше, щоб
-- окремо жила картка UWC Changshu. Наслідок вийшов ширший за намір: на цій
-- адресі можна було накопичувати НЕОБМЕЖЕНУ кількість копій, і на 10.09.2026
-- там лежало три активні картки UWC із трьома різними дедлайнами
-- (7 жовтня, 30 листопада, 30 листопада). Читач переходив за посиланням зі
-- статті й бачив не ту дату, яку йому обіцяли.
delete from dedup_hub_urls where url_prefix = 'https://ukraine.uwc.org/apply';

-- Склеюємо чотири картки в одну. Лишається найсвіжіша (додана 04.09) — у неї
-- єдиної правильний дедлайн 7 жовтня, звірений сьогодні з ukraine.uwc.org.
-- Changshu склеюється разом з рештою СВІДОМО: заявка на всі 18 коледжів UWC
-- подається через один національний комітет на тій самій сторінці, тож
-- окрема картка обіцяла окремий конкурс, якого немає.
update opportunities set
  status = 'closed',
  canonical_slug = 'uwc-ukraine-stypendii-dlia-navchannia-v-mizhnarodnykh-koledzhakh-806ed4',
  dup_of = 'uwc-ukraine-stypendii-dlia-navchannia-v-mizhnarodnykh-koledzhakh-806ed4',
  dup_score = 1.0,
  admin_comment = 'ручна склейка 10.09.2026: та сама заявка UWC через національний комітет',
  updated_at = now()
where slug in (
  'uwc-stypendii-u-mizhnarodni-koledzhi-52939f',   -- квітневий, дедлайн 30.11 вигаданий
  'stypendii-united-world-colleges-5f5f74',        -- з поста в Telegram, той самий дедлайн 7.10
  'uwc-changshu-china-stypendii-0d725e'            -- окремий коледж, спільна заявка
);

-- Вік у картці-переможці був 14–18. За умовами відбору подаються народжені
-- між 1 вересня 2009 і 1 вересня 2011 — на вересень 2026 це 15–17 років.
update opportunities set age_from = 15, age_to = 17, updated_at = now()
where slug = 'uwc-ukraine-stypendii-dlia-navchannia-v-mizhnarodnykh-koledzhakh-806ed4';

-- ── 2. Мовний префікс робив із однієї сторінки дві ────────────────────────
--
-- canonical_url не зрізав локаль зі шляху, тож /en/programs/... і
-- /programs/... були різними ключами. Так з'явилися дві картки FLEX із
-- різними дедлайнами і дві картки uBoost Career. Функцію виправлено
-- (scraper/canonical.py + scrapers/lib/canonical.mjs), тут — наслідки.
--
-- FLEX: лишається запис від 03.09 зі справжнього скрапера. У квітневого
-- дедлайн 15.09.2026 вигаданий: набір на 2027-28 American Councils ще не
-- оголошував, а торішнє вікно було 13 серпня – 16 вересня 2025.
update opportunities set
  status = 'closed',
  canonical_slug = 'prohrama-obminu-maibutnikh-lideriv-flex-758403',
  dup_of = 'prohrama-obminu-maibutnikh-lideriv-flex-758403',
  dup_score = 1.0,
  admin_comment = 'ручна склейка 10.09.2026: та сама сторінка, відрізнявся лише префікс /en/',
  updated_at = now()
where slug = 'flex-program-stypendiia-ssha-dlia-shkoliariv-320b7a';

-- uBoost: лишається старіший запис (18.05) — у нього довша історія в пошуку.
update opportunities set
  status = 'closed',
  canonical_slug = 'uboost-career-5c00d8',
  dup_of = 'uboost-career-5c00d8',
  dup_score = 1.0,
  admin_comment = 'ручна склейка 10.09.2026: та сама сторінка uboost.study/career',
  updated_at = now()
where slug = 'uboost-career-derzhavna-programa-dlia-molodi-bcb532';

-- ── 3. Перерахунок canonical_url під нове правило ─────────────────────────
--
-- Лише активні записи: у закритих дублів стара адреса лишається як слід того,
-- звідки вони прийшли. Список кодів дзеркалить LANG_PREFIXES в обох
-- реалізаціях канонізації — двобуквені сегменти, що частіше означають розділ
-- сайту, ніж мову (it, is, id, hc), туди свідомо не входять.
update opportunities set
  canonical_url = regexp_replace(
    canonical_url,
    '^(https://[^/]+)/(en|uk|ua|ru|de|pl|fr|es|pt|nl|sv|da|fi|cs|sk|ro|hu|bg|hr|sl|lt|lv|et|el|tr|he|ar|fa|hi|zh|ja|ko|ka|hy|az|kk|uz|sr|mk|sq|be)(-[a-z]{2})?/(.+)$',
    '\1/\4'
  ),
  updated_at = now()
where status = 'active'
  and canonical_url ~ '^https://[^/]+/(en|uk|ua|ru|de|pl|fr|es|pt|nl|sv|da|fi|cs|sk|ro|hu|bg|hr|sl|lt|lv|et|el|tr|he|ar|fa|hi|zh|ja|ko|ka|hy|az|kk|uz|sr|mk|sq|be)(-[a-z]{2})?/.+';

-- ── 4. Сліпа зона між двома механізмами дедуплікації ─────────────────────
--
-- Записи зі СПІЛЬНИМ canonical_url не ловив ЖОДЕН із двох механізмів:
--
--   • тригер trg_opportunities_dedup_guard спрацьовує лише BEFORE INSERT.
--     Але canonical_url більшості старих записів заповнив бекфіл (Фаза 1,
--     16.08) — тобто UPDATE'ом, уже після вставки. Тригер їх не бачив.
--   • find_dup_candidates мав умову `a.canonical_url is distinct from
--     b.canonical_url` — свідомо ПРОПУСКАВ такі пари, вважаючи, що ними
--     займається тригер.
--
-- Разом це давало дірку, крізь яку на 10.09.2026 пройшли 14 груп активних
-- записів зі спільною адресою (не рахуючи хабів). Друга умова,
-- `a.opportunity_type = b.opportunity_type`, добивала решту: картки UWC мали
-- типи exchange і scholarship, тож кандидатами не ставали й за назвою.
--
-- Тепер кандидатами стають і пари зі спільною адресою — незалежно від назви
-- й типу. Хаби, як і раніше, виключені: там на одному URL багато різних
-- можливостей, і збіг адреси нічого не означає.
create or replace function public.find_dup_candidates(
  sim_threshold real default 0.35,
  max_pairs integer default 30
)
returns table(id_a uuid, id_b uuid, sim real)
language sql
stable
as $function$
  with candidates as (
    -- А. Схожі назви на РІЗНИХ адресах — як було.
    select a.id as a_id, b.id as b_id, similarity(a.title, b.title) as sim
    from opportunities a
    join opportunities b
      on a.id < b.id
     and a.opportunity_type = b.opportunity_type
     and similarity(a.title, b.title) >= sim_threshold
    where a.status = 'active' and b.status = 'active'
      and a.canonical_url is distinct from b.canonical_url

    union all

    -- Б. Одна адреса — назва й тип не мають значення. Саме тут жили
    -- «Дитячий хор Щедрик» × 2 і Regeneron ISEF під двома назвами.
    select a.id, b.id, 1.0::real
    from opportunities a
    join opportunities b
      on a.id < b.id
     and a.canonical_url = b.canonical_url
    where a.status = 'active' and b.status = 'active'
      and a.canonical_url is not null
      and not exists (
        select 1 from dedup_hub_urls h
        where a.canonical_url like h.url_prefix || '%'
      )
  )
  select c.a_id, c.b_id, max(c.sim)::real
  from candidates c
  where not exists (
    select 1 from dedup_judgments j
    where j.id_a = c.a_id and j.id_b = c.b_id
  )
  group by c.a_id, c.b_id
  order by 3 desc, 1, 2
  limit max_pairs;
$function$;
