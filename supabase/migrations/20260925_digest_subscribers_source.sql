-- Звідки прийшов підписник Dityam+.
--
-- Пости в каналі вели на сторінку /plus, а не в бот, і звідки саме людина
-- прийшла, ми не знали взагалі: source писався лише для списку очікування
-- (plus_waitlist.source) і для промокодів. Тепер діп-лінк `from_<звідки>` з
-- поста ставить мітку при створенні рядка — видно, який формат поста продає.
alter table public.digest_subscribers add column if not exists source text;

comment on column public.digest_subscribers.source is
  'Мітка діп-лінка при першому /start: channel_topic, channel_deadlines тощо. Пишеться лише при створенні рядка — перший дотик важливіший за останній.';
