import { supabase } from '@/lib/supabase';

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
    .select('slug, title, summary, deadline, source_url, opportunity_type')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();

  if (!item) {
    return new Response('Not found', { status: 404 });
  }

  if (!item.deadline) {
    return new Response('No deadline for this opportunity', { status: 422 });
  }

  const pageUrl = `${SITE_URL}/o/${item.slug}`;
  const uid = `${item.slug}-deadline@dityam.com.ua`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dateStr = toDateStr(item.deadline);

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
    `DTSTART;TZID=Europe/Kyiv:${dateStr}T090000`,
    `DTEND;TZID=Europe/Kyiv:${dateStr}T095900`,
    foldLine(`SUMMARY:${escape(item.title)}`),
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
