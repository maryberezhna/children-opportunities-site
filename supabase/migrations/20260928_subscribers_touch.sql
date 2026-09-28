-- updated_at має означати «остання дія людини» — 28.09.2026.
--
-- Привід: Марія просить писати тому, хто завис до оплати або на ній, через
-- пʼять хвилин. Рахувати «пʼять хвилин без руху» не було чим: кроки анкети
-- оновлюють рядок БЕЗ updated_at (askPhone у app/api/telegram/plus/route.js —
-- приклад), тож у людини посеред анкети дата могла бути годинної давнини, і
-- нагадування прилетіло б їй просто під руку.
--
-- Тригер робить поле правдивим для будь-якого запису, хоч би звідки він
-- прийшов — бот, вебхук оплати чи рука в адмінці.
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists digest_subscribers_touch on digest_subscribers;
create trigger digest_subscribers_touch
  before update on digest_subscribers
  for each row execute function touch_updated_at();
