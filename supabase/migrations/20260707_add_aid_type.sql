-- Add aid_type: subcategory of state aid (держдопомога) for opportunities.
-- Surfaced in the UI as a nested sub-filter under the «Держдопомога» type.
alter table opportunities add column if not exists aid_type text;
comment on column opportunities.aid_type is
  'Subcategory of state aid (держдопомога): cash | scholarship | recreation | free_activities | vocational. NULL for non-state-aid opportunities.';

-- Seed tags for existing state programs, matched by source + title so that
-- EU / business programs merely hosted on easy.gov.ua are NOT swept in.

-- Грошові виплати родині (народження, усиновлення, ВПО, багатодітним, ТОТ)
update opportunities set aid_type = 'cash'
where source in ('ПФУ', 'Мінсоцполітики') and opportunity_type = 'allowance';

-- Соціальні стипендії від держави
update opportunities set aid_type = 'scholarship'
where title ilike 'Соціальні стипендії%';

-- Безкоштовне державне оздоровлення / путівки до таборів
update opportunities set aid_type = 'recreation'
where source = 'Фонд соціального захисту осіб з інвалідністю'
   or (source = 'Київ Цифровий' and title ilike '%путівк%');

-- Безкоштовні державні секції, гуртки, спортклуби
update opportunities set aid_type = 'free_activities'
where (source = 'Мінмолодьспорту' and opportunity_type = 'club')
   or title ilike 'Активні Парки%';

-- Державне проф. навчання / профорієнтація / зайнятість молоді
update opportunities set aid_type = 'vocational'
where source ilike '%easy.gov%'
  and (title ilike '%ваучер%' or title ilike 'Професійн%' or title ilike '%орієнтація молоді%');
