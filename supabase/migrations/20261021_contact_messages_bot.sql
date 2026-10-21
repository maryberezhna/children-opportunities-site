-- Тип звернення «Питання в боті Dityam+» (21.10.2026).
--
-- Питання, написане в @DityamPlusBot, досі лише летіло в адмін-чат Telegram
-- і ніде не зберігалось: у /admin/messages його не було, і «купа питань»
-- жила тільки в чаті (Марія: «чому ти отакі питання не підтягуєш в
-- адмінку»). Тепер вебхук бота пише його в contact_messages з type='bot',
-- contact='tg:<chat id>', page='@DityamPlusBot'.
--
-- Список має збігатися з CONTACT_TYPES у lib/contactTypes.js.
alter table contact_messages drop constraint if exists contact_messages_type_chk;
alter table contact_messages add constraint contact_messages_type_chk check (type in
  ('opportunity','story','error','complaint','partnership','media','olimpiada','ambassador','bot','other'));
