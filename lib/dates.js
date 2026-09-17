/**
 * Скільки днів лишилось — у календарних днях, а не в мілісекундах.
 *
 * Було: Math.ceil((дедлайн − локальна_північ) / доба). Локальна північ у
 * сервера (Vercel, UTC) і в браузера (Київ, UTC+3) — це різні моменти, тож
 * на тому самому записі сервер віддавав «⏰ 2 дні», а браузер рахував три.
 * Наслідків двоє, і обидва погані: React бачив розбіжність тексту з
 * серверною розміткою (помилки 425/418/423) і перемальовував увесь каталог
 * заново вже на клієнті; а до того моменту людина бачила число, менше за
 * справжнє на добу — саме там, де від нього залежить, чи встигне вона подати.
 *
 * Тепер обидві дати зводяться до номера календарної доби, і різниця — просте
 * віднімання цілих. Результат однаковий скрізь, від часового поясу не
 * залежить узагалі.
 *
 * «Сьогодні» рахуємо за Києвом і передаємо пропом із сервера: дедлайни в базі
 * — українські дати, і доба має закінчуватись тоді ж, коли в тих, хто подає.
 */

/** Поточна дата в Києві, YYYY-MM-DD. */
export function kyivToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Kyiv',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Номер календарної доби для YYYY-MM-DD (решта рядка ігнорується). */
function dayIndex(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
  if (!m) return null;
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ts) ? Math.floor(ts / 86400000) : null;
}

/**
 * Днів від `todayIso` до `dateStr`: 0 — сьогодні, 1 — завтра, −1 — учора.
 * null, якщо дати немає або вона нечитабельна.
 */
export function daysUntil(dateStr, todayIso) {
  const a = dayIndex(dateStr);
  const b = dayIndex(todayIso);
  if (a === null || b === null) return null;
  return a - b;
}

const MONTHS = {
  uk: ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'],
  en: ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'],
};

// UTC-складові, а не локальні: дата в базі календарна, і в поясі на захід
// від Гринвіча локальні getDate() зсувають її на добу назад.
export function formatDate(dateStr, lang = 'uk') {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = MONTHS[lang] || MONTHS.uk;
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

// Діапазон дат ПРОВЕДЕННЯ — окремий від дедлайну подачі.
//
// Коли місяць і рік збігаються, не повторюємо їх двічі: «6 — 8 листопада
// 2026», а не «6 листопада 2026 — 8 листопада 2026». Одноденна подія
// (початок = кінець) друкується один раз.
//
// Повертає null, якщо жодної дати проведення немає. Саме тут і був колишній
// баг: сторінка показувала лише «Дедлайн», а коли подія насправді
// відбувається — не показувала ніде, хоч event_end_date лежав у базі.
export function formatEventDates(item, lang = 'uk') {
  const from = formatDate(item?.event_start_date, lang);
  const to = formatDate(item?.event_end_date, lang);
  if (!from) return to;
  if (!to || to === from) return from;
  const a = new Date(item.event_start_date);
  const b = new Date(item.event_end_date);
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()} — ${to}`;
  }
  return `${from} — ${to}`;
}
