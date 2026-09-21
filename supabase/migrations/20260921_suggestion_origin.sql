-- Хто приніс пропозицію можливості.
--
-- У opportunity_suggestions пишуть троє: поп-ап на сайті (людина ззовні),
-- Марія (сесія Claude вносить можливість із її слів) і наші дослідження
-- (14.09.2026 «Дітям захисників» — 14 рядків). Поля «звідки» не було, тож
-- адмінка кожен рядок підписувала «зі сторінки поп-ап у каталозі», а в 👤
-- показувала поле contact. 20.09.2026 Марія принесла AI Kids Academy — сесія
-- поклала в contact Facebook організації, і адмінка показала його як
-- людину, що принесла новину. Лічильник «Можливостей принесли люди: 21»
-- рахував і 14 рядків власного дослідження.
--
-- Дефолт 'popup': форма /api/suggest поля не передає, а все, що прийшло
-- ззовні, — це саме поп-ап. Сесія, яка вносить пропозицію вручну, ставить
-- origin сама ('maria' або 'research'), а контакт організатора кладе в
-- коментар, не в contact: contact — це той, кому відповідаємо листом.

alter table opportunity_suggestions
  add column if not exists origin text not null default 'popup';

alter table opportunity_suggestions
  drop constraint if exists opportunity_suggestions_origin_check;
alter table opportunity_suggestions
  add constraint opportunity_suggestions_origin_check
  check (origin in ('popup', 'maria', 'research'));

-- Розмітка наявних рядків. Решта (Seniv Studio, «Діалог українських дітей
-- з Радою Європи», тестовий запис) справді прийшли з поп-апа.
update opportunity_suggestions set origin = 'research'
where comment like 'Дослідження «Дітям захисників» 14.09.2026%';

-- AI Kids Academy (20.09.2026, від Марії) розмічено окремим разовим
-- запитом, не тут: origin = 'maria', Facebook організації перенесено з
-- contact у коментар, source запису на сайті → veteran.com.ua.

-- Записи на сайті з цих пропозицій. process_suggestions.py ставив кожному
-- source «Пропозиція від організатора» — а це публічне «Джерело» на картці.
-- Для виплат міськрад, які знайшло наше дослідження, і для статті на
-- veteran.com.ua це неправда. Джерело — домен сторінки, як в інших
-- записах дослідження (rivnesoc.gov.ua, children.in.ua).
update opportunities o
set source = regexp_replace(substring(o.source_url from '^https?://([^/]+)'), '^www\.', ''),
    admin_comment = replace(o.admin_comment, '💡 пропозиція з форми на сайті', '🔎 з нашого дослідження, не з форми'),
    updated_at = now()
from opportunity_suggestions s
where s.origin = 'research'
  and (o.source_url = s.url or o.canonical_url = s.url)
  and o.source = 'Пропозиція від організатора';
