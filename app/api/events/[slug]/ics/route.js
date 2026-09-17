import { supabase } from '@/lib/supabase';
import { calendarTarget } from '@/lib/calendar-links';
import { kyivToday } from '@/lib/dates';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dityam.com.ua';

function foldLine(line) {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts = [];
  let start = 0;
  while (start < bytes.length) {
    const chunk = bytes.slice(start, start + (start === 0 ? 75 : 74));
    parts.push(chunk.toString('utf8'));
    start += start === 0 ? 75 : 74;
  }
  return parts.join('\r\n ');
}

function escape(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toDateStr(isoDate) {
  return isoDate.replace(/-/g, '');
}

export async function GET(request, { params }) {
  const { slug } = params;

  if (!supabase) {
    return new Response('Service unavailable', { status: 503 });
  }

  const { data: item } = await supabase
    .from('opportunities')
    .select('slug, title, summary, deadline, event_start_date, event_end_date, source_url, opportunity_type')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!item) {
    return new Response('Not found', { status: 404 });
  }

  // Дедлайн, поки він попереду, інакше — дати самої події. Раніше подію без
  // дедлайну додати в календар було неможливо: тут стояло 422.
  const target = calendarTarget(item, kyivToday());
  if (!target) {
    return new Response('No upcoming date for this opportunity', { status: 422 });
  }

  const pageUrl = `${SITE_URL}/o/${item.slug}`;
  const uid = `${item.slug}-${target.kind}@dityam.com.ua`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStr = toDateStr(target.start);
  const nextDay = (iso) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return toDateStr(d.toISOString().slice(0, 10));
  };
  // Дедлайн — зустріч о 09:00 того дня; подія — цілі дні проведення.
  const when = target.kind === 'deadline'
    ? [`DTSTART;TZID=Europe/Kyiv:${dateStr}T090000`, `DTEND;TZID=Europe/Kyiv:${dateStr}T095900`]
    : [`DTSTART;VALUE=DATE:${dateStr}`, `DTEND;VALUE=DATE:${nextDay(target.end)}`];
  const summary = target.kind === 'deadline' ? `Заявки до: ${item.title}` : item.title;

  const descParts = [item.summary || '', '', pageUrl].filter(Boolean);
  const description = escape(descParts.join('\n'));

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//dityam.com.ua//Add to Calendar//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Можливості для дитини',
    'X-WR-TIMEZONE:Europe/Kyiv',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Kyiv',
    'BEGIN:STANDARD',
    'DTSTART:19701025T030000',
    'TZOFFSETFROM:+0300',
    'TZOFFSETTO:+0200',
    'TZNAME:EET',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T020000',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0300',
    'TZNAME:EEST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    ...when,
    foldLine(`SUMMARY:${escape(summary)}`),
    foldLine(`DESCRIPTION:${description}`),
    `URL:${pageUrl}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    foldLine(`DESCRIPTION:Нагадування: ${escape(item.title)}`),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const ics = lines.join('\r\n');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.ics"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
