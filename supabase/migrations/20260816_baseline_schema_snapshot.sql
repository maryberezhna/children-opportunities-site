-- ============================================================================
-- BASELINE SNAPSHOT — 16.08.2026
--
-- Таблиці opportunities, admin_state, opportunity_suggestions, plus_waitlist
-- і digest_reminders_sent були створені руками в Supabase SQL editor і не мали
-- жодної міграції — схему бази неможливо було відтворити з репозиторію.
-- Цей файл знятий з живої бази (information_schema + pg_constraint + pg_indexes)
-- і фіксує фактичний стан. На живій базі він no-op (усюди IF NOT EXISTS),
-- на чистій базі відтворює схему повністю.
--
-- Таблиці opportunity_feedback, digest_subscribers, opportunity_outcomes уже
-- мають власні CREATE-міграції і сюди не входять. Таблиці meals, daily_summaries,
-- bf_* належать іншим проєктам у цій же базі і цим репозиторієм не керуються.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- opportunities — головна таблиця каталогу
-- ---------------------------------------------------------------------------
create table if not exists opportunities (
  id                 uuid primary key default uuid_generate_v4(),
  title              text not null,
  slug               text not null,
  summary            text,
  age_from           integer not null,
  age_to             integer not null,
  opportunity_type   text not null,
  categories         text[] default '{}'::text[],
  child_needs        text[] default '{}'::text[],
  format             text,
  cost_type          text,
  deadline           date,
  source_url         text,
  source             text,
  content_hash       text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now(),
  telegram_posted_at timestamptz,
  status             text not null default 'active',
  cities             text[] default '{}'::text[],
  aid_type           text,
  admin_comment      text,
  verified_at        timestamptz,
  dup_of             text,
  dup_score          real,
  price_note         text,
  details            text,
  canonical_slug     text,
  moderation_note    text,
  note_status        text,
  recurrence         text,

  constraint opportunities_slug_key unique (slug),
  constraint opportunities_hash_unique unique (content_hash),
  constraint opportunities_age_from_check check (age_from >= 0 and age_from <= 18),
  constraint opportunities_age_to_check check (age_to >= 0 and age_to <= 18),
  constraint opportunities_status_check check (status in ('active', 'closed', 'draft')),
  constraint opportunities_recurrence_check check (recurrence in ('annual', 'ongoing') or recurrence is null),
  constraint opportunities_cost_type_check check (cost_type in (
    'free', 'partially_free', 'paid_affordable', 'paid_premium', 'subsidized')),
  constraint opportunities_opportunity_type_check check (opportunity_type in (
    'course', 'workshop', 'summer_school', 'mentorship', 'club', 'camp',
    'study_program', 'olympiad', 'competition', 'hackathon', 'sport_tournament',
    'festival', 'award', 'exchange', 'excursion', 'residency', 'scholarship',
    'grant', 'allowance', 'support_payment', 'internship', 'volunteer',
    'conference', 'medical_aid', 'psychology', 'rehabilitation', 'humanitarian',
    'legal_aid', 'shelter', 'educational_material')),
  constraint opportunities_child_needs_check check (child_needs is null or child_needs <@ array[
    'gifted', 'disability', 'orphan', 'foster', 'idp', 'frontline',
    'veteran_family', 'fallen_serviceman_family', 'pow_family', 'oncology',
    'chronic_illness', 'low_income', 'large_family', 'single_parent'])
);

create index if not exists idx_opp_age on opportunities (age_from, age_to);
create index if not exists idx_opp_categories on opportunities using gin (categories);
create index if not exists idx_opp_deadline on opportunities (deadline);
create index if not exists idx_opp_needs on opportunities using gin (child_needs);
create index if not exists idx_opp_type on opportunities (opportunity_type);
create index if not exists idx_opportunities_status on opportunities (status);
create index if not exists opportunities_canonical_idx
  on opportunities (canonical_slug) where canonical_slug is not null;
create index if not exists opportunities_telegram_posted_at_idx
  on opportunities (telegram_posted_at) where telegram_posted_at is null;

alter table opportunities enable row level security;

do $$ begin
  create policy "Allow public read access" on opportunities
    for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- admin_state — стан Telegram-модерації («чекаємо нотатку від адміна»)
-- ---------------------------------------------------------------------------
create table if not exists admin_state (
  chat_id           text primary key,
  awaiting_note_for uuid references opportunities(id) on delete cascade,
  created_at        timestamptz not null default now()
);

alter table admin_state enable row level security;

-- ---------------------------------------------------------------------------
-- opportunity_suggestions — пропозиції можливостей від відвідувачів
-- ---------------------------------------------------------------------------
create table if not exists opportunity_suggestions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  url        text,
  comment    text,
  contact    text,
  status     text not null default 'new',
  created_at timestamptz not null default now()
);

alter table opportunity_suggestions enable row level security;

-- ---------------------------------------------------------------------------
-- plus_waitlist — список очікування Dityam+
-- ---------------------------------------------------------------------------
create table if not exists plus_waitlist (
  id                uuid primary key default gen_random_uuid(),
  email             text,
  source            text,
  created_at        timestamptz not null default now(),
  telegram_chat_id  text,
  telegram_username text,

  constraint plus_waitlist_email_key unique (email),
  constraint plus_waitlist_telegram_chat_id_key unique (telegram_chat_id),
  constraint waitlist_has_contact check (email is not null or telegram_chat_id is not null)
);

alter table plus_waitlist enable row level security;

-- ---------------------------------------------------------------------------
-- digest_reminders_sent — лог нагадувань про дедлайни (захист від повторів)
-- ---------------------------------------------------------------------------
create table if not exists digest_reminders_sent (
  id             uuid primary key default gen_random_uuid(),
  subscriber_id  uuid not null references digest_subscribers(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  days_before    smallint not null,
  sent_at        timestamptz not null default now(),

  constraint digest_reminders_sent_subscriber_id_opportunity_id_days_bef_key
    unique (subscriber_id, opportunity_id, days_before)
);

create index if not exists digest_reminders_sent_sub_idx
  on digest_reminders_sent (subscriber_id, sent_at desc);

alter table digest_reminders_sent enable row level security;
