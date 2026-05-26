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

export function addToCalendarPageUrl(slug) {
  return `${SITE_URL}/events/${slug}/add`;
}
