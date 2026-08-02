-- A/B тексту постів у каналі: разом з голосом 👍/👎 фіксуємо, який варіант
-- тексту людина бачила. Варіант приходить суфіксом у callback_data (fb:yes:<id>:a).
--
-- NULL = пост відправлено до запуску експерименту (або DIGEST_AB=off).
-- Тижневий admin-діджест рахує співвідношення 👍/👎 окремо по 'a' і 'b'.

alter table opportunity_feedback
  add column if not exists variant text check (variant in ('a', 'b'));

-- Вибірка «голоси за варіантом» у тижневому діджесті.
create index if not exists opportunity_feedback_variant_idx
  on opportunity_feedback (variant, value)
  where variant is not null;
