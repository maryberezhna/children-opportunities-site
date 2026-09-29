/**
 * Вибір трійки тижня. Живе окремо від скрипта, щоб його можна було перевірити
 * тестом: сам скрипт ходить у базу й у Telegram, а правило — чиста функція.
 */

export const MIN_DAYS = 3;    // менше — людина не встигне подати
export const MAX_DAYS = 30;   // більше — це вже не «цього тижня»

export const day = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
};

export function score(o, today) {
  const days = day(o.deadline) - today;
  let s = 0;
  // Що ближче дедлайн у вікні, то важливіше сказати про нього саме зараз.
  s += (MAX_DAYS - days) * 2;
  // Повнота запису: картка нагорі списку має виглядати доробленою.
  if ((o.cities || []).length) s += 12;
  if ((o.summary || '').length >= 120) s += 10;
  if (o.details && o.details.trim()) s += 6;
  // Ширший вік — більшій кількості родин підходить.
  s += (o.age_to - o.age_from);
  return s;
}

/**
 * `pinned` — усе, що людина відмітила цим тижнем у адмінці, БУДЬ-ЯКОЇ
 * вартості. `free` — кандидати для правила (лише безкоштовні з дедлайном).
 *
 * Чому вартість тут не перевіряється. Правило справді бере лише безкоштовні —
 * трійка тижня не повинна коштувати грошей. Але платне просування
 * організаторам (з 21.09.2026) виконується саме цією позначкою, і платний
 * запис мусить долишитись у трійці. Доти вибірка тягнула з бази тільки
 * `cost_type='free'`, тож платний пін не потрапляв ні в `manual`, ні в `keep`,
 * і наступний прогін скрипта мовчки знімав позначку — партнер платив за
 * тиждень, а зникав із блока в день, коли хтось перезапустив воркфлоу.
 */
export function selectWeeklyTop({ free = [], pinned = [], today }) {
  const picked = [...pinned];
  // Ручний вибір місця в трійці не звільняє: відмітили три — правило мовчить.
  const usedTypes = new Set(pinned.map((o) => o.opportunity_type));
  const pool = free
    .filter((o) => !pinned.some((p) => p.id === o.id))
    .map((o) => ({ ...o, days: day(o.deadline) - today }))
    .filter((o) => o.days >= MIN_DAYS && o.days <= MAX_DAYS)
    .sort((a, b) => score(b, today) - score(a, today));

  // Різні типи, поки вистачає кандидатів: три олімпіади поспіль — не добірка.
  for (const o of pool) {
    if (picked.length >= 3) break;
    if (usedTypes.has(o.opportunity_type)) continue;
    picked.push(o);
    usedTypes.add(o.opportunity_type);
  }
  for (const o of pool) {
    if (picked.length >= 3) break;
    if (!picked.some((p) => p.id === o.id)) picked.push(o);
  }
  return picked;
}
