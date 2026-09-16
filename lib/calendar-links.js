// Посилання на календар лишились тільки для Dityam+: кнопку «Додати в
// календар» під можливістю в добірці ставить бот (scraper/personal_digest.py),
// а сторінка /events/<slug>/add приймає цей клік. У відкритому каталозі
// кнопки немає свідомо — додавання дедлайну в календар належить підписці.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dityam.com.ua';

export function googleCalendarUrl({ title, description, date, url }) {
  const d = date.replace(/-/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${d}/${d}`,
    details: description ? `${description}\n\n${url}` : url,
    sprop: `website:${SITE_URL}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function appleCalendarUrl(slug) {
  return `${SITE_URL}/api/events/${slug}/ics`;
}
