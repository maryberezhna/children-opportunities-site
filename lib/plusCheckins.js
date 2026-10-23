// «Чи вдалося на щось подати заявку?» — загальне питання від @DityamPlusBot.
//
// Марія, 23.10.2026: «зроби так щоб дітям сам залежно від активності
// користування питав у користувача фідбек чи вдалося на щось податися».
//
// Питання «Ви подавалися?» (lib/plusOutcomes.js) приходить лише про можливість,
// яку людина позначила 👍 і яка вже минула. Таких мало: 22.10.2026 — 16
// позначок і жодна ще не минула, тобто людей ніхто нічого не питав. Це
// питання — загальне, без конкретної можливості, а як часто його ставити,
// вирішує активність людини (scraper/ask_checkin.py).
//
// Модуль чистий: тексти й розбір кнопок перевіряють тести, а питання шле
// Python — тому тексти кнопок дублюються в scraper/ask_checkin.py, і тест
// звіряє, що вони однакові.

export const CHECKIN_ANSWERS = [
  ['applied', '✅ Так, подали'],
  ['preparing', '⏳ Ще ні, готуємось'],
  ['nothing_fit', '🤷 Не знайшли підходящого'],
  ['not_looked', '😴 Ще не дивились'],
];

const CODES = new Set(CHECKIN_ANSWERS.map(([c]) => c));
export const checkinLabel = (code) => (CHECKIN_ANSWERS.find(([c]) => c === code) || [null, code])[1];

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * pchk:<відповідь>:<uuid рядка plus_checkins>  або  pchk:skip:<uuid>.
 * «pchk:nothing_fit:» + uuid — 53 байти, ліміт Telegram 64.
 */
export function parseCheckin(data) {
  const parts = String(data || '').split(':');
  if (parts[0] !== 'pchk' || parts.length !== 3 || !UUID.test(parts[2])) return null;
  if (parts[1] === 'skip') return { action: 'skip', id: parts[2], answer: null };
  if (CODES.has(parts[1])) return { action: 'answer', id: parts[2], answer: parts[1] };
  return null;
}

export const CHECKIN_QUESTION = 'Як ваші успіхи? 🙂\n\nЧи вдалося за останній час подати заявку на щось із того, що ми надсилали?';

// Два стовпці: підписи короткі й вміщаються.
export const checkinKeyboard = (id) => ({
  inline_keyboard: [
    CHECKIN_ANSWERS.slice(0, 2).map(([code, label]) => ({ text: label, callback_data: `pchk:${code}:${id}` })),
    CHECKIN_ANSWERS.slice(2).map(([code, label]) => ({ text: label, callback_data: `pchk:${code}:${id}` })),
  ],
});

export const checkinSkipKeyboard = (id) => ({
  inline_keyboard: [[{ text: 'Пропустити', callback_data: `pchk:skip:${id}` }]],
});

// Що бот каже одразу після кнопки. Там, де просимо текст, — питання; де ні —
// коротко, що зміниться від цієї відповіді.
export const CHECKIN_REPLY = {
  applied: 'Це чудово! 🎉 На що саме? Напишіть двома словами — так ми знатимемо, що вам підходить.',
  preparing: 'Записали. Щоб не пропустити дедлайн, натискайте 👍 під карткою в добірці — нагадаємо заздалегідь.',
  nothing_fit: 'Дякуємо, що сказали. Що ви шукаєте? Напишіть двома словами — підбиратимемо точніше.',
  not_looked: 'Гаразд 🙂 Добірки чекають у цьому чаті — коли буде хвилинка, гляньте.',
};

/** Чи просимо після цієї відповіді вільний текст. */
export const wantsNote = (answer) => answer === 'applied' || answer === 'nothing_fit';

export const CHECKIN_THANKS = {
  applied: 'Записали 🧡 Тепер знаємо, що вам підходить, — підбиратимемо точніше.',
  nothing_fit: 'Записали. Підбиратимемо точніше — під те, що ви шукаєте.',
};
export const CHECKIN_THANKS_SKIP = 'Гаразд. Головне, що відповіли — цього вже досить.';

/** Скільки хвилин після кнопки наступний текст читаємо як відповідь (як у plusOutcomes). */
export const CHECKIN_NOTE_WINDOW_MIN = 180;

/**
 * Рядок plus_checkins, що чекає на вільний текст, або null: відповідь з
 * текстом (applied / nothing_fit), тексту ще немає (note null), і кнопку
 * натиснули не пізніше ніж CHECKIN_NOTE_WINDOW_MIN хвилин тому.
 */
export function pendingCheckinNote(rows, now = new Date()) {
  const edge = new Date(now).getTime() - CHECKIN_NOTE_WINDOW_MIN * 60 * 1000;
  const waiting = (rows || []).filter((r) => {
    if (!r || (r.note !== null && r.note !== undefined) || !wantsNote(r.answer)) return false;
    const at = Date.parse(r.answered_at || '');
    return Boolean(at) && at >= edge;
  });
  waiting.sort((a, b) => Date.parse(b.answered_at) - Date.parse(a.answered_at));
  return waiting[0] || null;
}

/** Рядок для адмінки «Користувачі»: що людина відповіла востаннє. */
export function checkinNote(row) {
  if (!row?.answer) return null;
  const day = String(row.answered_at || row.asked_at || '').slice(0, 10).split('-').reverse().join('.');
  const text = row.note ? ` — «${String(row.note).slice(0, 120)}»` : '';
  return `📝 ${checkinLabel(row.answer).replace(/^\S+\s/, '')}${text}${day ? ` (${day})` : ''}`;
}
