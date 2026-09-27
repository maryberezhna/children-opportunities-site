// Звідки приходять підписники Dityam+ — для розділу на /admin/plus (27.09.2026).
//
// Джерело — digest_subscribers.source: мітка з діп-лінка `?start=from_<звідки>`
// (parseSourceArg у lib/plus.js), яку бот пише лише при СТВОРЕННІ рядка.
// Посилання з сайту несуть її з 27.09.2026 (#509), пости каналу — з 25.09.2026.
// Усі, хто прийшов раніше, простим /start чи за промокодом, лишаються «без
// мітки»: джерело промокоду живе окремо, у plus_promo_uses.

// Назви місць, звідки ставлять мітку. Ключ — рівно те, що стоїть після
// `from_` у посиланні: app/plus/PlusLanding.js, app/plus/SubscribeForm.js,
// app/PlusChoice.js, app/dedlainy/ReminderForm.js, scripts/check-deadlines.mjs.
const KNOWN = {
  plus_uk: 'Сайт · /plus, кнопка вгорі',
  plus_en: 'Сайт · /en/plus, кнопка вгорі',
  plus_form_uk: 'Сайт · /plus, кнопка внизу',
  plus_form_en: 'Сайт · /en/plus, кнопка внизу',
  plus_choice: 'Сайт · /plus, «Кава чи можливість»',
  deadlines_calendar: 'Сайт · /dedlainy',
  channel_topic: 'Канал · пост-підбірка',
  channel_deadlines: 'Канал · пост про дедлайни',
};

export const NO_SOURCE = 'Без мітки';

/** Людська назва мітки. Незнайома — як є, з групою за префіксом. */
export function sourceLabel(source) {
  if (!source) return NO_SOURCE;
  if (KNOWN[source]) return KNOWN[source];
  if (source.startsWith('channel_')) return `Канал · ${source.slice('channel_'.length)}`;
  return source;
}

/**
 * Рядки таблиці «Звідки прийшли»: скільки почали (будь-який статус) і скільки
 * зараз мають активну підписку. Спершу ті, що привели найбільше людей;
 * «без мітки» — завжди останнім, бо це не місце, а відсутність знання.
 */
export function countBySource(subs) {
  const rows = new Map();
  for (const s of subs || []) {
    const key = s?.source || null;
    const row = rows.get(key) || { source: key, label: sourceLabel(key), started: 0, active: 0 };
    row.started += 1;
    if (s?.status === 'active') row.active += 1;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => {
    if (!a.source !== !b.source) return a.source ? -1 : 1;
    return b.active - a.active || b.started - a.started || a.label.localeCompare(b.label, 'uk');
  });
}
