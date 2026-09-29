-- Історії родин для сайту (29.09.2026). Відгуків ми не вигадуємо, тож раз на
-- місяць канал просить розповісти, куди потрапила дитина (/contacts?type=story).
-- Опублікувати історію можна лише з окремої позначки людини — ця колонка її й
-- зберігає. Для інших звернень завжди false.
alter table contact_messages add column if not exists publish_consent boolean not null default false;
comment on column contact_messages.publish_consent is 'Людина дозволила опублікувати свою історію на сайті з іменем (лише тип story).';
