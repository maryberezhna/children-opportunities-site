// Загальний календар для підписки: webcal://dityam.com.ua/calendar.ics
//
// 25.08.2026 календар свят прибрали (#109) — сторінка /sviata мала 1 перегляд
// за 60 днів, а .ics лежав статичним файлом і містив лише свята. 15.10.2026
// Марія попросила оживити й додати туди те, заради чого його варто рекламувати:
// «нагадування про підписку і взагалі найкращі конкурси в україні або закордоном».
//
// Тепер це НЕ статичний файл, а жива стрічка: свята з data/events.json плюс
// дедлайни конкурсів, олімпіад і стипендій із бази. Календар у людини
// оновлюється сам (REFRESH-INTERVAL 12 год), тож нові конкурси доїжджають без
// повторної підписки.
import holidays from '@/data/events.json';
import { publicOpportunities, fetchAllRows, rowsOrThrow, isSupabaseConfigured } from '@/lib/supabase';
import { TYPE_LABELS } from '@/lib/labels';
import { allDayEvent, calendarWrap, dtstamp, foldLine, escapeIcs, toDateStr, nextDay } from '@/lib/ics';

export const runtime = 'nodejs';
// Раз на годину: дедлайни змінюються рідше, а .ics тягнуть десятки клієнтів.
export const revalidate = 3600;

const SITE_URL = 'https://dityam.com.ua';
const UTM = 'utm_source=calendar&utm_medium=ics&utm_campaign=sviata';

// Що вважаємо «конкурсами» для календаря. Редакційного рейтингу «найкращих» у
// базі немає, тож беремо типи, заради яких календар і заводять, — ті, що мають
// дедлайн подачі. Позначені в адмінці на тиждень (featured_week) ідуть із ⭐.
export const CALENDAR_TYPES = ['competition', 'olympiad', 'scholarship', 'grant', 'hackathon'];
const WINDOW_DAYS = 400;

const iso = (d) => d.toISOString().slice(0, 10);

async function contests() {
  if (!isSupabaseConfigured) return [];
  const today = new Date();
  const until = new Date(today.getTime() + WINDOW_DAYS * 86400000);
  return rowsOrThrow(await fetchAllRows(() => publicOpportunities(
    'slug, title, summary, deadline, opportunity_type, cost_type, featured_week',
  )
    .in('opportunity_type', CALENDAR_TYPES)
    .not('deadline', 'is', null)
    .gte('deadline', iso(today))
    .lte('deadline', iso(until))
    .order('deadline', { ascending: true })
    .order('id')), 'calendar.ics');
}

/** Дедлайн у календарі — подія на цілий день із нагадуванням за 3 дні. */
function deadlineEvent(o, stamp) {
  const url = `${SITE_URL}/o/${o.slug}?${UTM}`;
  const kind = TYPE_LABELS[o.opportunity_type] || 'Можливість';
  const free = o.cost_type === 'free' ? ' · безкоштовно' : '';
  const star = o.featured_week ? '⭐ ' : '';
  const desc = [
    o.summary || '',
    '',
    `${kind}${free}. Останній день подачі — ${o.deadline}.`,
    url,
    '',
    'Нагадування про дедлайни під вік та інтереси дитини — у Dityam+: '
      + `${SITE_URL}/plus?${UTM}`,
  ].filter((s) => s !== null).join('\n');
  return allDayEvent({
    uid: `deadline-${o.slug}@dityam.com.ua`,
    date: o.deadline,
    summary: `${star}⏰ Дедлайн: ${o.title}`,
    description: desc,
    url,
    stamp,
    alarmDays: 3,
  });
}

function holidayEvent(e, stamp) {
  const url = `${SITE_URL}/sviata?${UTM}`;
  return allDayEvent({
    uid: `sviato-${e.slug}-${e.date}@dityam.com.ua`,
    date: e.date,
    summary: `${e.emoji} ${e.summary}`,
    description: [e.description || '', '', `Календар свят і конкурсів: ${url}`].join('\n'),
    url,
    stamp,
  });
}

export async function GET() {
  const stamp = dtstamp();
  const events = [];

  for (const year of holidays.years || []) {
    for (const e of holidays.by_year[year] || []) events.push(...holidayEvent(e, stamp));
  }

  let list = [];
  try {
    list = await contests();
  } catch (e) {
    // База лягла — календар усе одно віддаємо, зі святами. Порожня стрічка
    // гірша за неповну: у підписників зникли б і свята ([[rowsOrThrow]]).
    console.error('[calendar.ics] contests:', e?.message || e);
  }
  for (const o of list) events.push(...deadlineEvent(o, stamp));

  const ics = calendarWrap({
    name: 'Dityam.com.ua — свята і дедлайни конкурсів',
    description: 'Українські свята, міжнародні дні для дітей і дедлайни конкурсів, '
      + 'олімпіад та стипендій. Оновлюється самостійно.',
    events,
  });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="dityam-calendar.ics"',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
