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

export function googleCalendarUrl({ title, description, date, endDate, url }) {
  const d = date.replace(/-/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: endDate ? `${d}/${dayAfter(endDate)}` : `${d}/${d}`,
    details: description ? `${description}\n\n${url}` : url,
    sprop: `website:${SITE_URL}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function appleCalendarUrl(slug) {
  return `${SITE_URL}/api/events/${slug}/ics`;
}
