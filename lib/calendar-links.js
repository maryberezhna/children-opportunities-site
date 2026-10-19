// Посилання на календар лишились тільки для Dityam+: кнопку «Додати в
// календар» під можливістю в добірці ставить бот (scraper/personal_digest.py),
// а сторінка /events/<slug>/add приймає цей клік. У відкритому каталозі
// кнопки немає свідомо — додавання дедлайну в календар належить підписці.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dityam.com.ua';

import { daysUntil } from './dates.js';

/**
 * Що ставити в календар: дедлайн подачі, поки він попереду, інакше — дати
 * самої події. До 17.09.2026 календар знав лише дедлайн: подію з датами, але
 * без дедлайну, додати було неможливо (сторінка редиректила, .ics віддавав 422),
 * а коли дедлайн і подія були обидва — у календар потрапляв лише дедлайн.
 */
export function calendarTarget(item, todayIso) {
  const dl = daysUntil(item?.deadline, todayIso);
  if (dl !== null && dl >= 0) return { kind: 'deadline', start: item.deadline, end: item.deadline };
  const start = item?.event_start_date || item?.event_end_date;
  const end = item?.event_end_date || item?.event_start_date;
  const left = daysUntil(end, todayIso);
  if (start && left !== null && left >= 0) return { kind: 'event', start, end };
  return null;
}

/** Наступний день YYYY-MM-DD → YYYYMMDD: у Google кінець цілоденної події не включно. */
function dayAfter(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Посилання, яке відкриває Google Calendar із уже заповненою подією.
 *
 * `dates` мусить бути ПРОМІЖКОМ. До 25.09.2026 дедлайн давав
 * «20261020/20261020» — початок і кінець в один день, — і Google таку подію
 * не створював: людина тиснула «📅» і поверталась ні з чим. Тепер обидва
 * випадки мають довжину, і обидва такі самі, як у .ics (api/events/<slug>/ics),
 * щоб календар не залежав від того, якою кнопкою його наповнили:
 *   • дедлайн — зустріч о 09:00 того дня, з київським часовим поясом;
 *   • подія — цілі дні, де кінець не включно (тому наступний день).
 */
export function googleCalendarUrl({ title, description, date, endDate, url }) {
  const d = date.replace(/-/g, '');
  const isDeadline = !endDate;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: isDeadline ? `Заявки до: ${title}` : title,
    dates: isDeadline ? `${d}T090000/${d}T095900` : `${d}/${dayAfter(endDate)}`,
    details: description ? `${description}\n\n${url}` : url,
    sprop: `website:${SITE_URL}`,
  });
  if (isDeadline) params.set('ctz', 'Europe/Kyiv');
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function appleCalendarUrl(slug) {
  return `${SITE_URL}/api/events/${slug}/ics`;
}

/**
 * Пряме посилання «у календар» для картки в боті — дзеркало
 * scraper/calendar_link.py (calendar_url у personal_digest.py). null — додавати
 * нічого: дедлайн минув і подія теж, або дат немає зовсім.
 *
 * До 29.09.2026 перша добірка після оплати (route.js, sendLatest) вела на
 * сторінку сайту /events/<slug>/add і ставила кнопку за будь-якої дати, навіть
 * торішньої. #493 полагодив це лише в щоденній добірці.
 */
export function botCalendarUrl(item, todayIso) {
  const target = calendarTarget(item, todayIso);
  if (!target) return null;
  return googleCalendarUrl({
    title: item.title,
    description: item.summary || '',
    date: target.start,
    endDate: target.kind === 'deadline' ? null : target.end,
    url: `${SITE_URL}/o/${item.slug}`,
  });
}

// ---- Закритий набір: нагадати про наступний (19.10.2026) ----
//
// Сторінки закритих щорічних програм (IOI, FLEX, Conrad…) тримають тисячі
// показів у Google, але людині, що на них прийшла, нічого було робити.
// Рішення Марії: лишити сторінку, великими літерами сказати «набір закрито»
// і дати кнопку «нагадати про набір наступного року» З ЧІТКО ВИЗНАЧЕНОЮ ДАТОЮ.
//
// Дату не вигадуємо: нагадування є лише тоді, коли відома дата (дедлайн або
// початок події) ще ПОПЕРЕДУ — Марія: «нагадування на майбутні тільки».
// З торішнього дедлайну наступний набір не вираховуємо. Нагадуємо за два
// тижні до дедлайну (за місяць до початку події), але не раніше ніж сьогодні.
// Одноразова програма, запис без дат чи з датою в минулому — null.
import { isPeriodic } from './timing.js';
import { formatDate } from './dates.js';

const REMINDER_LEAD_DAYS = { deadline: 14, event: 30 };

function shiftIso(iso, { days = 0 }) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * { date, next, basis } або null.
 *   date  — коли нагадати (YYYY-MM-DD);
 *   next  — відома майбутня дата, перед якою нагадуємо;
 *   basis — 'deadline' | 'event'.
 */
export function nextIntakeReminder(item, todayIso) {
  if (!item || !isPeriodic(item)) return null;
  const basis = item.deadline ? 'deadline' : (item.event_start_date ? 'event' : null);
  if (!basis) return null;
  const next = basis === 'deadline' ? item.deadline : item.event_start_date;
  const left = daysUntil(next, todayIso);
  if (left === null || left < 0) return null;
  let date = shiftIso(next, { days: -REMINDER_LEAD_DAYS[basis] });
  if (daysUntil(date, todayIso) < 0) date = todayIso;
  return { date, next, basis };
}

/** Слова для події в календарі — ті самі в Google-посиланні й у .ics. */
export function reminderText(item, reminder, lang = 'uk') {
  const en = lang === 'en';
  const next = formatDate(reminder.next, lang);
  const summary = en
    ? `Check if applications are open: ${item.title}`
    : `Чи відкрито набір: ${item.title}`;
  const nextLine = reminder.basis === 'deadline'
    ? (en ? `Deadline we know of: ${next}.` : `Відомий нам дедлайн: ${next}.`)
    : (en ? `Start date we know of: ${next}.` : `Відомий нам початок: ${next}.`);
  const description = en
    ? `${nextLine} Check the organiser's page to see if applications are open.`
    : `${nextLine} Перевірте на сторінці організатора, чи відкрито набір.`;
  return { summary, description };
}

/** Google Calendar: цілоденне нагадування на обчислену дату. */
export function reminderCalendarUrl(item, reminder, lang = 'uk') {
  const { summary, description } = reminderText(item, reminder, lang);
  const url = `${SITE_URL}${lang === 'en' ? '/en' : ''}/o/${item.slug}`;
  return googleCalendarUrl({ title: summary, description, date: reminder.date, endDate: reminder.date, url });
}
