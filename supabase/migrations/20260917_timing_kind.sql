-- ============================================================================
-- Вид можливості за часом — 17.09.2026
--
-- Аудит «Дедлайн, подія, сезон» показав: поділу на одноразові, періодичні й
-- постійні можливості в базі немає. Його вгадували з opportunity_type у
-- п'яти різних місцях із п'ятьма різними списками типів, а поле recurrence
-- ('annual' | 'ongoing' | null) не вміє сказати «одноразова» — null там
-- означає і «одноразова», і «невідомо». Наслідки:
--   • 128 періодичних програм (зокрема Всеукраїнські олімпіади з математики,
--     фізики, інформатики) закриті назавжди, без дати повторної перевірки;
--   • 755 активних записів позначені «постійними» масовою дією за типом
--     (11.09.2026), а не з тексту;
--   • 88 активних записів без жодної дати не закриються ніколи.
--
-- Рішення Марії 17.09.2026:
--   one_time  — вебінар, когортний курс, конкретний конкурс;
--   periodic  — олімпіада, стипендія, щорічний конкурс, щорічна літня школа,
--               гурток із набором у вересні;
--   permanent — виплата, допомога, гурток із постійним набором, платформи з
--               вільним записом (Coursera, Prometheus, Дія.Освіта).
-- Вид читається з тексту; тип — лише підказка. NULL = ще не визначено.
alter table opportunities add column if not exists timing_kind text;

alter table opportunities drop constraint if exists opportunities_timing_kind_check;
alter table opportunities
  add constraint opportunities_timing_kind_check
  check (timing_kind is null or timing_kind in ('one_time', 'periodic', 'permanent'));

create index if not exists idx_opportunities_timing_kind
  on opportunities (timing_kind);

-- Місяці сезону періодичної можливості: коли зазвичай відкрита подача або
-- проходить подія. Звідси планова перевірка знатиме, коли дивитись на
-- джерело знову, — замість перечитувати всю базу щодня за TTL типу.
alter table opportunities add column if not exists season_months smallint[];

alter table opportunities drop constraint if exists opportunities_season_months_check;
alter table opportunities
  add constraint opportunities_season_months_check
  check (season_months is null
         or season_months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]);

comment on column opportunities.timing_kind is
  'Вид за часом: one_time | periodic | permanent. З тексту джерела, не з типу. NULL — не визначено.';
comment on column opportunities.season_months is
  'Для periodic: місяці (1–12), коли зазвичай відкрита подача або проходить подія.';
