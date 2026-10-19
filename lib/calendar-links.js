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
// Дату не вигадуємо, а виводимо з того, що знаємо: торішній дедлайн плюс
// рік, мінус два тижні — щоб лишився час подати. Коли дедлайну немає, а є
// дата події — її початок плюс рік, мінус місяць. Одноразова програма чи
// запис без дат — null: «наступного року» для них нема звідки взяти.
import { isPeriodic } from './timing.js';
import { formatDate } from './dates.js';

const REMINDER_LEAD_DAYS = { deadline: 14, event: 30 };

function shiftIso(iso, { years = 0, days = 0 }) {
  const d = new Date(`${iso}T00:00:00Z`);
  if (years) d.setUTCFullYear(d.getUTCFullYear() + years);
  if (days) d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * { date, next, last, basis, lastIsPast } або null.
 *   date  — коли нагадати (YYYY-MM-DD);
 *   next  — відома дата, перенесена вперед до найближчого року, коли
 *           нагадування ще попереду (орієнтир);
 *   last  — відома дата, з якої рахували;
 *   basis — 'deadline' | 'event';
 *   lastIsPast — чи відома дата вже минула. Закритий запис може мати дату
 *           попереду (дедлайн з опису, закрили рукою) — тоді «торік» казати
 *           не можна, і нагадування ставиться перед цією ж датою.
 * Якщо запис закрили понад рік тому, рік додається, доки дата не попереду.
 */
export function nextIntakeReminder(item, todayIso) {
  if (!item || !isPeriodic(item)) return null;
  const basis = item.deadline ? 'deadline' : (item.event_start_date ? 'event' : null);
  if (!basis) return null;
  const last = basis === 'deadline' ? item.deadline : item.event_start_date;
  if (daysUntil(last, todayIso) === null) return null;
  const lead = REMINDER_LEAD_DAYS[basis];
  let next = last;
  let date = shiftIso(next, { days: -lead });
  for (let i = 0; i < 10 && daysUntil(date, todayIso) < 0; i++) {
    next = shiftIso(next, { years: 1 });
    date = shiftIso(next, { days: -lead });
  }
  return { date, next, last, basis, lastIsPast: daysUntil(last, todayIso) < 0 };
}

/** Слова для події в календарі — ті самі в Google-посиланні й у .ics. */
export function reminderText(item, reminder, lang = 'uk') {
  const en = lang === 'en';
  const last = formatDate(reminder.last, lang);
  const summary = en
    ? `Check if applications are open: ${item.title}`
    : `Чи відкрито набір: ${item.title}`;
  let lastLine;
  if (!reminder.lastIsPast) {
    lastLine = en ? `Date we know of: ${last}.` : `Відома нам дата: ${last}.`;
  } else if (reminder.basis === 'deadline') {
    lastLine = en ? `Last year applications closed on ${last}.` : `Торік заявки приймали до ${last}.`;
  } else {
    lastLine = en ? `Last year it started on ${last}.` : `Торік подія починалась ${last}.`;
  }
  const description = en
    ? `${lastLine} The organiser has not announced the next intake yet — check the page.`
    : `${lastLine} Нового набору організатор ще не оголосив — перевірте сторінку.`;
  return { summary, description };
}

/** Google Calendar: цілоденне нагадування на обчислену дату. */
export function reminderCalendarUrl(item, reminder, lang = 'uk') {
  const { summary, description } = reminderText(item, reminder, lang);
  const url = `${SITE_URL}${lang === 'en' ? '/en' : ''}/o/${item.slug}`;
  return googleCalendarUrl({ title: summary, description, date: reminder.date, endDate: reminder.date, url });
}
