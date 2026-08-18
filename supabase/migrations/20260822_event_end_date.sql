-- Дата завершення датованої події (табір, фестиваль, фінал конкурсу).
-- Після цієї дати нічний check-deadlines закриває запис незалежно від
-- дедлайну подачі: подія, що минула, не сміє висіти активною
-- (кейс «ATLAS Weekend — дитяча зона» активний через місяць після події).
alter table opportunities add column if not exists event_end_date date;

create index if not exists idx_opportunities_event_end
  on opportunities (event_end_date)
  where event_end_date is not null;
