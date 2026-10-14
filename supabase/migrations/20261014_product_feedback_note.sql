-- Текстовий відгук після оцінки (Марія, 14.10.2026: після 😍/😐/🙁 бот просить
-- «поділіться детальніше» з force_reply). Відповідь лягає сюди, в note
-- останнього відгуку чату (lib/feedback.js → handleFeedbackReply).
alter table public.product_feedback add column if not exists note text;
