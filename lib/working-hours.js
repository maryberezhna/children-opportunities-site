/**
 * Робочий час: коли людині, що нам написала, відповідаємо одразу, а коли —
 * обіцяємо відповідь у робочі години.
 *
 * Марія, 22.10.2026: «всі хто нам пише питання після 18.00 — ми обовʼязково
 * відповідаємо у робочі години».
 *
 * Чесне «відповімо зранку» краще за «якомога швидше», після якого людина
 * чекає всю ніч і вирішує, що її проігнорували. А щоб обіцянка не лишилась
 * словами, о 9:00 адмін-чат отримує список тих, хто написав поза робочим
 * часом і досі без відповіді (app/api/cron/after-hours/route.js).
 *
 * Час — київський, як і в night-prompt.js: робочі години наші, а не людини.
 */
import { kyivHour } from './night-prompt.js';

/** Робочі години за Києвом: з 9:00 до 18:00. */
export const WORK_FROM = 9;
export const WORK_TO = 18;

/** Чи зараз поза робочим часом за Києвом. */
export function isAfterHours(now = new Date()) {
  const h = kyivHour(now);
  return h >= WORK_TO || h < WORK_FROM;
}

/** «з 9:00 до 18:00» — щоб години в текстах не розʼїхались із перевіркою. */
export const WORK_HOURS_TEXT = `з ${WORK_FROM}:00 до ${WORK_TO}:00 за київським часом`;
export const WORK_HOURS_TEXT_EN = `${WORK_FROM}:00–${WORK_TO}:00 Kyiv time`;

/** Година й хвилина за Києвом, «21:14» — для позначки в адмін-чаті. */
export function kyivTime(now = new Date()) {
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: 'Europe/Kyiv', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
}

/** За скільки днів нагадувати про звернення без відповіді. */
export const REMIND_DAYS = 3;
/** Скільки звернень показувати в одному повідомленні. */
export const DIGEST_MAX = 15;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function kyivDay(d) {
  return new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', day: '2-digit', month: '2-digit' }).format(d);
}

/**
 * Ранкове нагадування в адмін-чат: хто написав поза робочим часом і досі без
 * відповіді. rows — contact_messages зі статусом 'new'; ті, що прийшли в
 * робочий час, сюди не йдуть: їх уже бачили в сповіщенні вдень.
 * Нікого немає — null, і в чат нічого не летить.
 */
export function afterHoursDigest(rows, typeMap, siteUrl = 'https://dityam.com.ua') {
  const waiting = (rows || []).filter((r) => isAfterHours(new Date(r.created_at)));
  if (!waiting.length) return null;
  // Telegram ріже повідомлення довше за 4096 символів — решту видно в адмінці.
  const shown = waiting.slice(0, DIGEST_MAX);
  const lines = shown.map((r) => {
    const at = new Date(r.created_at);
    const t = typeMap[r.type] || { emoji: '💬', label: r.type };
    const who = r.type === 'bot' ? '@DityamPlusBot' : esc(r.contact || '');
    const snippet = esc(String(r.message || '').replace(/\s+/g, ' ').slice(0, 140));
    return `${t.emoji} ${kyivDay(at)} о ${kyivTime(at)} · ${esc(t.label)} · ${who}\n«${snippet}»`;
  });
  return [
    `🌙 <b>Чекають відповіді з неробочого часу: ${waiting.length}</b>`,
    'Цим людям ми пообіцяли відповісти в робочі години.',
    '',
    lines.join('\n\n'),
    waiting.length > shown.length ? `\n…і ще ${waiting.length - shown.length} — в адмінці.` : null,
    '',
    'На питання з бота — реплаєм на його сповіщення вище.',
    `<a href="${siteUrl}/admin/messages">Відкрити в адмінці →</a>`,
  ].filter((l) => l !== null).join('\n');
}
