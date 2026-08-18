-- Сезонне «подивитися ще раз»: при закритті датованої події (фестиваль,
-- табір, літня школа) check-deadlines ставить recheck_at = closed + 11 міс.
-- Коли дата настає, ttl_requeue перечитує сторінку; якщо там нова річна
-- програма з відкритим набором — переекстракція оживляє запис (normalizer
-- ставить status=active при enrollment=open). Одна спроба на сезон:
-- recheck_at знімається одразу при перевірці.
alter table opportunities add column if not exists recheck_at date;

create index if not exists idx_opportunities_recheck
  on opportunities (recheck_at)
  where recheck_at is not null;
