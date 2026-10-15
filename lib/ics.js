// Складання .ics (RFC 5545). Винесено з app/api/events/[slug]/ics, щоб тими
// самими правилами користувався й загальний календар /calendar.ics
// (15.10.2026, Марія: «оживи календар… і додай туди найкращі конкурси»).

/**
 * Рядок довший за 75 байтів складаємо, як вимагає RFC 5545.
 *
 * Ріжемо ПО СИМВОЛАХ, а не по байтах: до 15.10.2026 тут був зріз buffer.slice(),
 * і довгий опис українською розпадався посеред двобайтової літери — у календарі
 * з'являлося «безкош<?>овно». Межа 75 байтів лишається, просто жоден символ
 * більше не ділиться навпіл.
 */
export function foldLine(line) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line;
  const out = [];
  let cur = '';
  let limit = 75;
  for (const ch of line) {
    if (Buffer.byteLength(cur + ch, 'utf8') > limit) {
      out.push(cur);
      cur = ch;
      limit = 74;        // у продовженні перший байт займає пробіл
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out.join('\r\n ');
}

export function escapeIcs(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export const toDateStr = (isoDate) => String(isoDate).slice(0, 10).replace(/-/g, '');

/** Наступний день — для DTEND, який у VALUE=DATE не включається. */
export function nextDay(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return toDateStr(d.toISOString().slice(0, 10));
}

export const VTIMEZONE_KYIV = [
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
];

export const dtstamp = (now = new Date()) =>
  `${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

/**
 * Подія на цілий день (свято): DTSTART;VALUE=DATE.
 * alarmDays — за скільки днів нагадати; null — без нагадування.
 */
export function allDayEvent({ uid, date, summary, description, url, stamp, alarmDays = null }) {
  const lines = [
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}`),
    foldLine(`DTSTAMP:${stamp}`),
    `DTSTART;VALUE=DATE:${toDateStr(date)}`,
    `DTEND;VALUE=DATE:${nextDay(date)}`,
    foldLine(`SUMMARY:${escapeIcs(summary)}`),
  ];
  if (description) lines.push(foldLine(`DESCRIPTION:${escapeIcs(description)}`));
  if (url) lines.push(foldLine(`URL:${url}`));
  lines.push('TRANSP:TRANSPARENT');
  if (alarmDays != null) {
    lines.push('BEGIN:VALARM', `TRIGGER:-P${alarmDays}D`, 'ACTION:DISPLAY',
      foldLine(`DESCRIPTION:${escapeIcs(summary)}`), 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

/** Обгортка календаря. */
export function calendarWrap({ name, description, events }) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//dityam.com.ua//Calendar//UK',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeIcs(name)}`),
    foldLine(`X-WR-CALDESC:${escapeIcs(description)}`),
    'X-WR-TIMEZONE:Europe/Kyiv',
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
    ...VTIMEZONE_KYIV,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}
