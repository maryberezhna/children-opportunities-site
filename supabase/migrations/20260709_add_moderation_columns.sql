-- Moderation & duplicate-analysis columns for the /admin review queue.
alter table opportunities add column if not exists admin_comment text;
alter table opportunities add column if not exists verified_at timestamptz;
alter table opportunities add column if not exists dup_of text;    -- slug of the likely-duplicate match
alter table opportunities add column if not exists dup_score real; -- title similarity 0..1 with dup_of

comment on column opportunities.admin_comment is 'Moderator note left in /admin; mirrored to the Notion «Модерація» database.';
comment on column opportunities.verified_at is 'When a moderator manually verified the source link in /admin.';
comment on column opportunities.dup_of is 'Slug of an existing opportunity this draft likely duplicates (60–80% title match).';
