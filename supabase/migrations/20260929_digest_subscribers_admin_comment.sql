-- /api/cron/nudge-stuck (#554) читає й пише digest_subscribers.admin_comment,
-- а колонки не було: з 28.09.2026 16:46 кожен прохід падав на
-- «column digest_subscribers.admin_comment does not exist», і жоден, хто
-- завис до оплати, нагадування не отримав. Застосовано в базі 29.09.2026.
alter table digest_subscribers add column if not exists admin_comment text;
comment on column digest_subscribers.admin_comment is 'Службова нотатка про підписника (напр. чому нагадування /api/cron/nudge-stuck не доставлено). Людям не показується.';
