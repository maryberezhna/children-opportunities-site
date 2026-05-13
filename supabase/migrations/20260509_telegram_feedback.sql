-- Telegram-канал: реакція "цікаво / не цікаво" під постами.
-- Кожен Telegram-юзер може мати один голос на одну можливість;
-- повторний тап тієї ж кнопки знімає голос, протилежної — перемикає.

-- Тип opportunity_id має збігатись із opportunities.id (зазвичай UUID у Supabase).
-- Якщо у вашій таблиці інший тип — підкоригуйте перший рядок CREATE TABLE.

CREATE TABLE IF NOT EXISTS opportunity_feedback (
  opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  value TEXT NOT NULL CHECK (value IN ('yes', 'no')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS opportunity_feedback_opp_value_idx
  ON opportunity_feedback (opportunity_id, value);

-- RLS: таблиця приходить з даними тільки від service_role через webhook,
-- публічний доступ не потрібен. Вмикаємо RLS без політик = повний дроп
-- для anon/authenticated, а service_role обходить RLS.
ALTER TABLE opportunity_feedback ENABLE ROW LEVEL SECURITY;
