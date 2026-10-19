import { supabase } from '@/lib/supabase';
import { calendarTarget, nextIntakeReminder, reminderText } from '@/lib/calendar-links';
import { kyivToday } from '@/lib/dates';
// Спільне складання .ics із /calendar.ics. До 15.10.2026 тут була власна копія
// foldLine, яка різала рядок по байтах і ламала українські літери навпіл.
import { foldLine, escapeIcs as escape, toDateStr, VTIMEZONE_KYIV } from '@/lib/ics';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dityam.com.ua';

const nextDay = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return toDateStr(d.toISOString().slice(0, 10));
};

export async function GET(request, { params }) {
  const { slug } = params;
  const lang = new URL(request.url).searchParams.get('lang') === 'en' ? 'en' : 'uk';

  if (!supabase) {
    return new Response('Service unavailable', { status: 503 });
  }

  // Закриті теж віддаємо (19.10.2026): для них у календар іде не дедлайн, а
  // нагадування перевірити наступний набір (nextIntakeReminder).
  const { data: item } = await supabase
    .from('opportunities')
    .select('slug, title, summary, deadline, event_start_date, event_end_date, source_url, opportunity_type, status, timing_kind')
    .eq('slug', slug)
    .in('status', ['active', 'closed'])
    .maybeSingle();

  if (!item) {
    return new Response('Not found', { status: 404 });
  }

  const today = kyivToday();
  // Дедлайн, поки він попереду, інакше — дати самої події. Раніше подію без
  // дедлайну додати в календар було неможливо: тут стояло 422.
  const target = item.status === 'active' ? calendarTarget(item, today) : null;
  const reminder = target ? null : nextIntakeReminder(item, today);
  if (!target && !reminder) {
    return new Response('No upcoming date for this opportunity', { status: 422 });
  }

  const pageUrl = `${SITE_URL}${lang === 'en' ? '/en' : ''}/o/${item.slug}`;
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  let uid;
  let when;
  let summary;
  let description;
  let alarmText;
  if (target) {
    uid = `${item.slug}-${target.kind}@dityam.com.ua`;
    const dateStr = toDateStr(target.start);
    // Дедлайн — зустріч о 09:00 того дня; подія — цілі дні проведення.
    when = target.kind === 'deadline'
      ? [`DTSTART;TZID=Europe/Kyiv:${dateStr}T090000`, `DTEND;TZID=Europe/Kyiv:${dateStr}T095900`]
      : [`DTSTART;VALUE=DATE:${dateStr}`, `DTEND;VALUE=DATE:${nextDay(target.end)}`];
    summary = target.kind === 'deadline' ? `Заявки до: ${item.title}` : item.title;
    description = [item.summary || '', '', pageUrl].filter(Boolean).join('\n');
    alarmText = `Нагадування: ${item.title}`;
  } else {
    const text = reminderText(item, reminder, lang);
    uid = `${item.slug}-reminder-${reminder.next.slice(0, 4)}@dityam.com.ua`;
    when = [`DTSTART;VALUE=DATE:${toDateStr(reminder.date)}`, `DTEND;VALUE=DATE:${nextDay(reminder.date)}`];
    summary = text.summary;
    description = `${text.description}\n\n${pageUrl}`;
    alarmText = text.summary;
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//dityam.com.ua//Add to Calendar//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Можливості для дитини',
    'X-WR-TIMEZONE:Europe/Kyiv',
    ...VTIMEZONE_KYIV,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    ...when,
    foldLine(`SUMMARY:${escape(summary)}`),
    foldLine(`DESCRIPTION:${escape(description)}`),
    `URL:${pageUrl}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    foldLine(`DESCRIPTION:${escape(alarmText)}`),
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
