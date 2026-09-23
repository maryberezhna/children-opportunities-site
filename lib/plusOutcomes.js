// «Чим закінчилось» — питання від @DityamPlusBot про можливість, яка минула.
//
// Марія 23.09.2026: «відмічають цікаво — коли можливість пройшла, то
// зʼявляється питання: ви скористалися цією можливістю? Так чи ні. Якщо так —
// то розкажіть, як вам. Якщо ні — то чому, і дропдаун з опціями».
//
// Проміжного кроку «Тримаємо кулаки 🤞 Уже є відповідь?» тут немає свідомо:
// Марія відхилила його того ж дня. Після «Так» одразу просимо розповісти, як
// було, — без гілок «ще чекаємо / взяли / відмовили».
//
// Модуль чистий (жодних запитів у базу), щоб питання й розбір кнопок
// перевірялись тестами, а не лише живим ботом. Питання шле
// scraper/ask_outcomes.py, натискання обробляє app/api/telegram/plus/route.js —
// тексти кнопок мають бути ті самі, тож вони живуть в одному місці.

// Причини «чому не скористались». Коди короткі навмисне: callback_data в
// Telegram — 64 байти, а туди ще має влізти uuid можливості (36 символів).
// Порядок той самий, що бачить людина.
export const OUTCOME_REASONS = [
  ['late', 'Не встигли, забули'],
  ['changed', 'Передумали — не підійшло'],
  ['child', 'Дитина не зацікавилась'],
  ['docs', 'Забагато документів'],
  ['terms', 'Не підійшли умови (вік, місто, вартість)'],
  ['price', 'Дорого'],
  ['other', 'Інша причина'],
];

export const REASON_CODES = new Set(OUTCOME_REASONS.map(([code]) => code));

export const reasonLabel = (code) => (OUTCOME_REASONS.find(([c]) => c === code) || [null, code])[1];

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Розбір callback_data кнопок «чим закінчилось».
 *
 * pout:yes:<uuid>          — скористались
 * pout:no:<uuid>           — не скористались
 * pout:why:<код>:<uuid>    — причина зі списку
 * pout:skip:<uuid>         — «Пропустити» замість вільного тексту
 *
 * Повертає { action, id, reason } або null, якщо це не наша кнопка. Чужі
 * префікси (flow:, pfb:, papp:, menu:) сюди не потрапляють — розбір бота
 * лишається однозначним.
 */
export function parseOutcome(data) {
  const parts = String(data || '').split(':');
  if (parts[0] !== 'pout') return null;
  if (parts.length === 3 && ['yes', 'no', 'skip'].includes(parts[1]) && UUID.test(parts[2])) {
    return { action: parts[1], id: parts[2], reason: null };
  }
  if (parts.length === 4 && parts[1] === 'why' && REASON_CODES.has(parts[2]) && UUID.test(parts[3])) {
    return { action: 'why', id: parts[3], reason: parts[2] };
  }
  return null;
}

export const askKeyboard = (id) => ({
  inline_keyboard: [[
    { text: 'Так', callback_data: `pout:yes:${id}` },
    { text: 'Ні', callback_data: `pout:no:${id}` },
  ]],
});

// Один рядок на причину: назви довгі, у два стовпці вони обрізаються.
export const whyKeyboard = (id) => ({
  inline_keyboard: OUTCOME_REASONS.map(([code, label]) => [
    { text: label, callback_data: `pout:why:${code}:${id}` },
  ]),
});

export const skipKeyboard = (id) => ({
  inline_keyboard: [[{ text: 'Пропустити', callback_data: `pout:skip:${id}` }]],
});

// Формулювання Марії, слово в слово (23.09.2026).
export const ASK_STORY = 'Розкажіть двома словами, як вам?';
export const ASK_WHY = 'Чому?';
export const ASK_OTHER = 'Напишіть двома словами — що саме?';
export const THANKS = 'Дякуємо 🧡';

/**
 * Скільки хвилин після натискання «Так» чи «Інша причина» наступний текст у
 * чаті читаємо як відповідь, а не як питання в підтримку.
 *
 * Вікно коротке навмисне. Помилитись можна двічі, і ціна різна: прийняти
 * питання в підтримку за відгук — значить не показати його Марії зовсім;
 * прийняти пізній відгук за питання — значить показати його Марії в
 * адмін-чаті. Друге дешевше, тож краще закрити вікно раніше.
 */
export const NOTE_WINDOW_MIN = 180;

/**
 * Рядок plus_applications, що чекає на вільний текст, або null.
 *
 * Стан навмисне НЕ живе в digest_subscribers.flow_step: там крокує анкета
 * (lib/digestFlow.js), і будь-яке стороннє значення там або обірвало б анкету
 * на півслові, або саме загубилось би від наступного /start. Тут стан
 * виводиться з даних: «відповідь є (answered_at), тексту ще немає (note is
 * null), і текст справді просили».
 *
 * Просили його у двох випадках: «Так» (stage='used' → «Розкажіть двома
 * словами, як вам?») і «Інша причина» (reason='other'). Після «Ні» з
 * конкретною причиною тексту не просимо — і там note одразу '' .
 */
export function pendingNote(rows, now = new Date()) {
  const edge = new Date(now).getTime() - NOTE_WINDOW_MIN * 60 * 1000;
  const waiting = (rows || []).filter((r) => {
    if (!r || r.note !== null && r.note !== undefined) return false;
    const at = Date.parse(r.answered_at || '');
    if (!at || at < edge) return false;
    return r.stage === 'used' || r.reason === 'other';
  });
  waiting.sort((a, b) => Date.parse(b.answered_at) - Date.parse(a.answered_at));
  return waiting[0] || null;
}
