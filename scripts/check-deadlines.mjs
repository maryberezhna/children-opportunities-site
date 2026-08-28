/**
 * Daily deadline check.
 *
 * For every opportunity with deadline <= today:
 * - If type is "annual" (olympiads, contests, scholarships, exchanges, grants,
 *   study_abroad) — clear `deadline = NULL`. The next scrape will repopulate
 *   with this year's date when the source publishes it. We do NOT try to add
 *   +1 year ourselves because the actual deadline often shifts.
 *   Festivals and camps are NOT annual here: they are date-bound events, and a
 *   past event must close, not sit visible "till next year" (the ATLAS bug).
 * - Otherwise — mark `cost_type = 'closed'` so UI hides the "apply now" CTA.
 *
 * Separately, every non-closed opportunity with event_end_date < today is
 * closed: the event has happened, regardless of deadlines.
 *
 * Also prints (and writes to artifact) a report with stats and the items that
 * are due within the next 7 / 30 days.
 *
 * Optionally posts a short summary to Telegram if TELEGRAM_BOT_TOKEN +
 * TELEGRAM_CHAT_ID are set AND --notify flag is passed (or NOTIFY=true env).
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (UPDATE bypasses RLS — anon key won't work)
 * Optional:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, NOTIFY=true
 *   DRY_RUN=true   → print actions without writing to DB
 */
import { createClient } from '@supabase/supabase-js';
import { opportunitiesWord } from '../lib/plural.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ANNUAL_TYPES = new Set([
  'olympiad', 'competition', 'exchange', 'scholarship',
  'grant', 'study_abroad',
]);

// Сезонні типи: закриваємо чесно, але через ~11 місяців дивимось ще раз —
// ttl_requeue перечитає сторінку, і нова річна програма оживить запис.
const SEASONAL_RECHECK_TYPES = new Set([
  'festival', 'camp', 'summer_school', 'sport_tournament', 'excursion',
]);
const seasonalRecheck = (type) => {
  if (!SEASONAL_RECHECK_TYPES.has(type)) return {};
  const d = new Date();
  d.setMonth(d.getMonth() + 11);
  return { recheck_at: d.toISOString().slice(0, 10) };
};

const TYPE_LABELS = {
  course: 'Курс',
  olympiad: 'Олімпіада',
  competition: 'Конкурс',
  club: 'Гурток',
  exchange: 'Обмін',
  camp: 'Табір',
  study_abroad: 'Навчання за кордоном',
  scholarship: 'Стипендія',
  allowance: 'Виплата',
  grant: 'Грант',
  festival: 'Фестиваль',
  sport_event: 'Спорт',
  medical_aid: 'Мед. допомога',
  psychology: 'Психологія',
  rehabilitation: 'Реабілітація',
  humanitarian: 'Гум. допомога',
  internship: 'Стажування',
  volunteer: 'Волонтерство',
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const NOTIFY = process.env.NOTIFY === 'true' || process.argv.includes('--notify');
const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
// PREVIEW=true — зібрати пости й надрукувати, нічого не шлючи і не змінюючи
// в базі. FORCE_DAY=0..6 — показати формат конкретного дня тижня (для вичитки).
const PREVIEW = process.env.PREVIEW === 'true';
const FORCE_DAY = process.env.FORCE_DAY != null && process.env.FORCE_DAY !== ''
  ? Number(process.env.FORCE_DAY) : null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const today = new Date();
today.setHours(0, 0, 0, 0);
const stamp = today.toISOString().slice(0, 10);

// Look 30 days ahead so we also produce a "due soon" list for the report.
const lookahead = new Date(today);
lookahead.setDate(today.getDate() + 30);

// Скільки днів має лишатись до дедлайну, щоб можливість узагалі потрапила в
// пост. Дайджест виходить о 09:00: можливість із дедлайном «сьогодні» —
// це не можливість, а привід засмутитись. На заявку треба зібрати документи,
// спитати батьків, інколи щось відсканувати, тож нижня межа — три дні.
const MIN_LEAD_DAYS = Number(process.env.MIN_LEAD_DAYS || 3);
const minLead = new Date(today);
minLead.setDate(today.getDate() + MIN_LEAD_DAYS);
const minLeadIso = minLead.toISOString().slice(0, 10);

const { data, error } = await supabase
  .from('opportunities')
  .select('id, slug, title, summary, opportunity_type, age_from, age_to, deadline, event_end_date, cost_type, status, source_url')
  .not('deadline', 'is', null)
  .lte('deadline', lookahead.toISOString().slice(0, 10));

if (error) {
  console.error('Supabase select error:', error);
  process.exit(1);
}

const expiredAnnual = [];      // → deadline = NULL
const expiredOneShot = [];     // → cost_type = 'closed'
const dueSoon = [];            // 0..30 days, just for report

for (const row of data || []) {
  const dl = new Date(row.deadline);
  dl.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((dl - today) / 86400000);

  if (daysLeft < 0) {
    if (ANNUAL_TYPES.has(row.opportunity_type)) expiredAnnual.push({ ...row, daysLeft });
    else if (row.status !== 'closed') expiredOneShot.push({ ...row, daysLeft });
    // already-closed one-shots: skip silently
  } else {
    dueSoon.push({ ...row, daysLeft });
  }
}

dueSoon.sort((a, b) => a.daysLeft - b.daysLeft);

console.log(`Deadline check — ${stamp}${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log('='.repeat(60));
console.log(`Found: ${expiredAnnual.length} annual to refresh, ${expiredOneShot.length} one-shot to close, ${dueSoon.length} due soon.`);
console.log('');

let archived = 0;
let refreshed = 0;
let failed = 0;

if (expiredOneShot.length > 0) {
  console.log(`🔴 ARCHIVING ${expiredOneShot.length} expired one-shot opportunities (cost_type='closed'):`);
  for (const r of expiredOneShot) {
    console.log(`  ${r.deadline}  [${-r.daysLeft}d ago]  ${r.title}`);
    if (!DRY_RUN) {
      const { error: e } = await supabase
        .from('opportunities')
        .update({ status: 'closed', updated_at: new Date().toISOString(),
                  ...seasonalRecheck(r.opportunity_type) })
        .eq('id', r.id);
      if (e) { failed += 1; console.error(`    ✗ ${e.message}`); }
      else archived += 1;
    }
  }
  console.log('');
}

if (expiredAnnual.length > 0) {
  console.log(`🟡 CLEARING deadlines on ${expiredAnnual.length} annual events (next scrape will refill):`);
  for (const r of expiredAnnual) {
    console.log(`  ${r.deadline}  [${-r.daysLeft}d ago]  ${r.title}  (${r.opportunity_type})`);
    if (!DRY_RUN) {
      const { error: e } = await supabase
        .from('opportunities')
        .update({ deadline: null, updated_at: new Date().toISOString() })
        .eq('id', r.id);
      if (e) { failed += 1; console.error(`    ✗ ${e.message}`); }
      else refreshed += 1;
    }
  }
  console.log('');
}

// --- Події, що вже відбулися (event_end_date < today) ---
const { data: endedEvents, error: endedErr } = await supabase
  .from('opportunities')
  .select('id, title, event_end_date, opportunity_type')
  .not('event_end_date', 'is', null)
  .lt('event_end_date', stamp)
  .neq('status', 'closed');

if (endedErr) console.error('Supabase select (ended events) error:', endedErr);

let endedClosed = 0;
if ((endedEvents || []).length > 0) {
  console.log(`🏁 CLOSING ${endedEvents.length} finished events (event_end_date passed):`);
  for (const r of endedEvents) {
    console.log(`  ${r.event_end_date}  ${r.title}  (${r.opportunity_type})`);
    if (!DRY_RUN) {
      const { error: e } = await supabase
        .from('opportunities')
        .update({ status: 'closed', updated_at: new Date().toISOString(),
                  ...seasonalRecheck(r.opportunity_type) })
        .eq('id', r.id);
      if (e) { failed += 1; console.error(`    ✗ ${e.message}`); }
      else endedClosed += 1;
    }
  }
  console.log('');
}

console.log(`🟢 DUE WITHIN 30 DAYS (${dueSoon.length}):`);
for (const r of dueSoon) {
  const tag = r.daysLeft <= 7 ? '⚡' : '  ';
  console.log(` ${tag} ${r.deadline}  [in ${r.daysLeft}d]  ${r.title}`);
}

if (!DRY_RUN) {
  console.log('');
  console.log(`Done: archived=${archived}, events-closed=${endedClosed}, deadline-cleared=${refreshed}, failed=${failed}`);
}

// --- Persist artifact for GitHub Actions ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'output');
await mkdir(outDir, { recursive: true });

const reportLines = [
  `Deadline check — ${stamp}`,
  '='.repeat(60),
  `archived=${archived}, events-closed=${endedClosed}, deadline-cleared=${refreshed}, failed=${failed}, due-soon=${dueSoon.length}`,
  '',
  `Expired one-shot → archived (cost_type='closed'):`,
  ...expiredOneShot.map((r) => `  ${r.deadline} [${-r.daysLeft}d]  ${r.title}`),
  '',
  `Finished events → closed (event_end_date passed):`,
  ...(endedEvents || []).map((r) => `  ${r.event_end_date}  ${r.title}`),
  '',
  `Expired annual → deadline cleared:`,
  ...expiredAnnual.map((r) => `  ${r.deadline} [${-r.daysLeft}d]  ${r.title}`),
  '',
  `Due within 30 days:`,
  ...dueSoon.map((r) => `  ${r.deadline} [in ${r.daysLeft}d]  ${r.title}`),
];
await writeFile(join(outDir, `deadline-report-${stamp}.txt`), reportLines.join('\n'), 'utf8');

// Sun=0, Mon=1, ..., Sat=6 — index matches Date#getDay().
// Declared before sendDailyDigest's invocation so the const is initialized
// (TDZ would throw otherwise — JS hoists `const` declarations but keeps them
// uninitialized until execution reaches the declaration line).
const THEMES = [
  { // Sunday
    heading: '🧸 Сьогодні — для малюків (0-6 років)',
    description: 'Розвивальні заняття, гуртки, медична та соціальна допомога для найменших.',
    filter: (r) => r.age_from <= 6 && r.age_to <= 8,
    link: 'https://dityam.com.ua/?age=0-3,4-6',
  },
  { // Monday
    heading: '📚 Сьогодні — для школярів (7-11 років)',
    description: 'Курси, гуртки, олімпіади та конкурси для дітей молодшої школи.',
    filter: (r) => r.age_from <= 11 && r.age_to >= 7,
    link: 'https://dityam.com.ua/?age=7-11',
  },
  { // Tuesday
    heading: '🎒 Сьогодні — для підлітків (12-17 років)',
    description: 'Стажування, обміни, гранти, конкурси та літні програми для старшокласників.',
    filter: (r) => r.age_to >= 12 && r.age_from <= 17,
    link: 'https://dityam.com.ua/?age=12-14,15-17',
  },
  { // Wednesday
    heading: '🎁 Сьогодні — безкоштовні можливості',
    description: 'Програми без жодних витрат — для всіх дітей від 0 до 18 років.',
    filter: (r) => r.cost_type === 'free',
    link: 'https://dityam.com.ua/?cost=free',
  },
  { // Thursday
    heading: '🌍 Сьогодні — можливості за кордоном',
    description: 'Міжнародні обміни, навчання за кордоном та стипендії для українських дітей.',
    filter: (r) => ['exchange', 'study_abroad', 'scholarship'].includes(r.opportunity_type),
    link: 'https://dityam.com.ua/?type=exchange,study_abroad,scholarship',
  },
  { // Friday
    heading: '🎨 Сьогодні — творчість, STEM та конкурси',
    description: 'Курси, гуртки, олімпіади та конкурси для тих, хто любить творити й досліджувати.',
    filter: (r) => ['course', 'competition', 'club', 'olympiad'].includes(r.opportunity_type),
    link: 'https://dityam.com.ua/?type=course,competition,club,olympiad',
  },
  { // Saturday
    heading: '⭐ Сьогодні — нові на сайті',
    description: 'Свіжі надходження — програми, щойно додані до каталогу.',
    filter: () => true,
    sortBy: 'created_at_desc',
    link: 'https://dityam.com.ua/?sort=recent',
  },
];

// Формат поста за днем тижня. Сім однакових дайджестів на тиждень читати
// нудно, тож ритм міняється: історія → дайджест → ситуація → цифра.
// 0=Нд ... 6=Сб. Затверджено 19.08.2026.
const FORMAT_BY_DAY = [
  'number',    // Нд — цифра дня + рядок про підтримку
  'situation', // Пн — життєва ситуація
  'story',     // Вт — одна можливість глибоко
  'digest',    // Ср — класичний дайджест
  'story',     // Чт — одна можливість глибоко
  'digest',    // Пт — класичний дайджест
  'digest',    // Сб — дайджест із темою «нові на сайті»
];

// Ситуації для формату «situation»: починаємо з болю батьків, а не з програми.
// Ротація по тижнях, щоб та сама ситуація не поверталась щопонеділка.
const SITUATIONS = [
  {
    text: '«Дитині 15, хоче спробувати щось своє, а грошей на гуртки зараз немає»',
    filter: (r) => r.age_to >= 14 && r.cost_type === 'free',
  },
  {
    text: '«Переїхали в іншу область, дитина ні з ким не знайома і сидить у телефоні»',
    filter: (r) => r.cost_type === 'free' && ['club', 'camp', 'course', 'competition'].includes(r.opportunity_type),
  },
  {
    text: '«Дитина здібна до математики, а в нашій школі це нікому не потрібно»',
    // Тип «конкурс» надто широкий — під нього підпадають і спортивні
    // змагання. Тому додатково звіряємося зі словами в назві й описі.
    filter: (r) => ['olympiad', 'competition', 'hackathon'].includes(r.opportunity_type)
      && /(математик|фізик|хімі|біолог|інформатик|наук|stem|дослідн|інженер|винахід|програм)/i
        .test(`${r.title || ''} ${r.summary || ''}`),
  },
  {
    text: '«Хочемо, щоб дитина побачила світ, але бюджету на поїздки немає»',
    filter: (r) => ['exchange', 'study_abroad', 'scholarship'].includes(r.opportunity_type),
  },
  {
    text: '«Щойно народилась дитина — і незрозуміло, що взагалі належить родині»',
    filter: (r) => r.age_from <= 3 && r.cost_type === 'free',
  },
  {
    text: '«Дитина цілий день малює, а куди з цим піти — не знаємо»',
    filter: (r) => ['festival', 'competition', 'club', 'workshop'].includes(r.opportunity_type),
  },
];

// Shown once every ~3 weeks (21-day cycle) instead of the weekday theme.
const PAID_THEME = {
  heading: '💳 Сьогодні — платні можливості',
  description: 'Курси, гуртки, табори та програми з оплатою — обрані найцікавіші для дітей 0–18.',
  filter: (r) => r.cost_type && !['free', 'closed'].includes(r.cost_type),
  link: 'https://dityam.com.ua/?cost=partially_free',
};

// --- Optional: notify Telegram with daily digest ---
if (PREVIEW) {
  // Вичитка: показуємо пости на всі сім днів тижня за один прогін.
  const DAYS = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];
  for (let d = 0; d < 7; d += 1) {
    console.log(`\n${'='.repeat(64)}\n${DAYS[d].toUpperCase()} — формат «${FORMAT_BY_DAY[d]}»\n${'='.repeat(64)}`);
    await sendDailyDigest(d);
  }
} else if (NOTIFY && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID && !DRY_RUN) {
  await sendDailyDigest();
}

async function sendDailyDigest(dayOverride = null) {
  // Section A: truly urgent — deadline MIN_LEAD_DAYS..7 days. Top 3.
  // Було 0..3, тобто в «терміново» потрапляли й ті, що спливають сьогодні.
  // Піднявши нижню межу, довелось підняти й верхню: інакше в секцію
  // проходили б лише записи рівно з трьома днями і вона б порожніла.
  const urgent = dueSoon
    .filter((r) => r.daysLeft >= MIN_LEAD_DAYS && r.daysLeft <= 7)
    .slice(0, 3);

  // Section B: themed pool — fetch all active opportunities (not closed),
  // either with no deadline or with deadline in the future.
  const { data: poolData, error: poolErr } = await supabase
    .from('opportunities')
    .select('id, slug, title, summary, opportunity_type, age_from, age_to, cost_type, deadline, event_end_date, created_at, source, child_needs')
    .eq('status', 'active')
    .or(`deadline.is.null,deadline.gte.${minLeadIso}`);
  if (poolErr) {
    console.error(`Pool fetch failed: ${poolErr.message}`);
    return;
  }
  const pool = (poolData || []).filter((r) => !urgent.some((u) => u.id === r.id));

  // Once every ~3 weeks (a 21-day cycle) swap the weekday theme for a paid
  // collection, so the channel isn't only free opportunities.
  const dayOfYear = Math.floor(
    (Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
      - Date.UTC(today.getUTCFullYear(), 0, 1)) / 86400000);
  const theme = dayOfYear % 21 === 0 ? PAID_THEME : THEMES[dayOverride ?? FORCE_DAY ?? today.getDay()];
  let themed = pool.filter(theme.filter);
  if (theme.sortBy === 'created_at_desc') {
    themed.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } else {
    themed = shuffle(themed);
  }
  themed = themed.slice(0, 3);

  if (urgent.length === 0 && themed.length === 0) {
    console.log('Nothing to post — both sections empty.');
    return;
  }

  const weekday = dayOverride ?? FORCE_DAY ?? today.getDay();
  const format = FORMAT_BY_DAY[weekday];
  const weekIndex = Math.floor(dayOfYear / 7);

  // --- Формат «story»: одна можливість глибоко ---
  if (format === 'story') {
    const hero = urgent[0] || themed[0];
    if (hero) {
      const heroLines = buildStoryPost(hero, theme);
      await postToChannel(heroLines, `story (${hero.slug})`);
      return;
    }
  }

  // --- Формат «situation»: життєва ситуація + 3 відповіді ---
  if (format === 'situation') {
    const situation = SITUATIONS[weekIndex % SITUATIONS.length];
    const picks = shuffle(pool.filter(situation.filter)).slice(0, 3);
    if (picks.length >= 2) {
      const sLines = [`<b>${situation.text}</b>`, ''];
      sLines.push(`${picks.length === 3 ? 'Три варіанти' : 'Ось варіанти'}, за які не треба платити:`);
      sLines.push('');
      picks.forEach((r, i) => {
        sLines.push(formatLine(r, i));
        if (i < picks.length - 1) sLines.push('');
      });
      sLines.push('');
      sLines.push(`👉 Ще ${freeCountForPost(pool)} безкоштовних — на <a href="https://dityam.com.ua">dityam.com.ua</a>`);
      await postToChannel(sLines, 'situation');
      return;
    }
  }

  // --- Формат «number»: одна цифра + пояснення ---
  if (format === 'number') {
    const nLines = buildNumberPost(pool, weekIndex);
    if (nLines) {
      nLines.push('');
      nLines.push('🧡 Каталог безкоштовний і живе без реклами. Підтримати — <a href="https://send.monobank.ua/jar/F72fDrV2c">банка monobank</a> або <a href="https://dityam.com.ua/support">інші способи</a>.');
      await postToChannel(nLines, 'number');
      return;
    }
  }

  // --- Формат «digest» (і запасний варіант, якщо для інших не набралось) ---
  const lines = [];
  if (urgent.length > 0) {
    lines.push(`⏰ <b>Дедлайн наближається (${urgent.length})</b>`);
    lines.push('');
    urgent.forEach((r, i) => {
      lines.push(formatLine(r, i));
      if (i < urgent.length - 1) lines.push('');
    });
    lines.push('');
  }
  if (themed.length > 0) {
    lines.push(`<b>${theme.heading}</b>`);
    if (theme.description) lines.push(`<i>${theme.description}</i>`);
    lines.push('');
    themed.forEach((r, i) => {
      lines.push(formatLine(r, i));
      if (i < themed.length - 1) lines.push('');
    });
    lines.push('');
  }
  // Секція «нові»: раніше окремі картки слав telegram-bot (до 8 повідомлень
  // на день). Тепер новинки живуть тут, одним рядком кожна — канал має рівно
  // один пост на добу. У суботу цю секцію не додаємо: тема дня і так «нові».
  if ((dayOverride ?? FORCE_DAY ?? today.getDay()) !== 6) {
    const dayAgo = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    const fresh = pool
      .filter((r) => (r.created_at || '') >= dayAgo)
      .filter((r) => !themed.some((t) => t.id === r.id))
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 3);
    if (fresh.length > 0) {
      lines.push(`🆕 <b>Щойно додали</b>`);
      lines.push('');
      fresh.forEach((r, i) => {
        lines.push(formatLine(r, i));
        if (i < fresh.length - 1) lines.push('');
      });
      lines.push('');
    }
  }

  const moreUrl = theme.link || 'https://dityam.com.ua';
  lines.push(`🔗 Більше — на <a href="https://dityam.com.ua">dityam.com.ua</a>${moreUrl !== 'https://dityam.com.ua' ? ` · <a href="${moreUrl}">добірка дня</a>` : ''}`);

  // Прохання про підтримку — раз на тиждень, у неділю, рядком усередині
  // дайджесту. Окремий суботній пост скасовано: він був другим за добу.
  if ((dayOverride ?? FORCE_DAY ?? today.getDay()) === 0) {
    lines.push('');
    lines.push('🧡 Каталог безкоштовний і живе без реклами. Підтримати — <a href="https://send.monobank.ua/jar/F72fDrV2c">банка monobank</a> або <a href="https://dityam.com.ua/support">інші способи</a>.');
  }

  // Dityam+ продає не доступ, а роботу: відбір, нагадування, допомогу із
  // заявкою. Тому в каналі не тизер «що ви пропустили», а пропозиція зняти
  // з людини рутину. Усе з діджесту лишається відкритим для всіх.
  lines.push('');
  lines.push('⚡ Не встигаєте стежити за дедлайнами? <a href="https://dityam.com.ua/pidbirka">Dityam+</a> відбере ваші й нагадає вчасно.');

  await postToChannel(lines, `digest (urgent=${urgent.length}, themed=${themed.length})`);
}

/** Відправка в канал. Один шлях для всіх форматів поста. */
async function postToChannel(lines, label) {
  const text = lines.join('\n');
  if (DRY_RUN || PREVIEW) {
    console.log(`\n--- ПОСТ [${label}] ---\n${text}\n--- /ПОСТ ---`);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const json = await res.json();
    if (json.ok) console.log(`📨 Пост надіслано — ${label}.`);
    else console.error(`Telegram error: ${json.description}`);
  } catch (e) {
    console.error(`Telegram send failed: ${e.message}`);
  }
}

/** Формат «story»: одна можливість розгорнуто. */
function buildStoryPost(r, theme) {
  const url = `https://dityam.com.ua/o/${r.slug}`;
  const lines = [`<b>${escapeHtml(r.title)}</b>`, ''];

  if (r.summary) lines.push(escapeHtml(r.summary.slice(0, 400)));
  lines.push('');

  const age = ageLabel(r);
  if (age) lines.push(`👶 Для кого: ${age}`);
  const typeLabel = TYPE_LABELS[r.opportunity_type];
  if (typeLabel) lines.push(`📚 Формат: ${typeLabel}`);
  if (r.cost_type === 'free') lines.push('✅ Скільки коштує: нічого');
  else if (r.cost_type === 'partially_free') lines.push('💳 Скільки коштує: є фінансування');

  const when = whenLine(r);
  if (when) lines.push(when);
  else lines.push('⏰ Дедлайну немає — набір триває');

  lines.push('');
  lines.push(`👉 <a href="${url}">Умови й подача — на dityam.com.ua</a>`);
  if (theme?.link) lines.push(`🔗 Схожі можливості — <a href="${theme.link}">тут</a>`);
  return lines;
}

/** Формат «number»: одна цифра, яка щось означає. */
function buildNumberPost(pool, weekIndex) {
  const free = pool.filter((r) => r.cost_type === 'free').length;
  const sources = new Set(pool.map((r) => r.source).filter(Boolean)).size;
  const withNeeds = pool.filter((r) => (r.child_needs || []).length > 0).length;

  const CARDS = [
    {
      value: free,
      text: [
        'Стільки безкоштовних можливостей для дітей відкрито просто зараз: гуртки, табори, олімпіади, стипендії, виплати.',
        '',
        'Це не оцінка, а точне число з каталогу на сьогодні. Вони працюють, і вони справді безкоштовні.',
        '',
        'Питання лише в тому, чи родина про них дізнається.',
      ],
    },
    {
      value: sources,
      text: [
        'Стільки різних джерел ми перечитуємо, щоб зібрати ці можливості в одному місці: сайти міністерств, фондів, громадських організацій, телеграм-канали.',
        '',
        'Родині не треба обходити їх усі. Достатньо одного сайту.',
      ],
    },
    {
      value: withNeeds,
      text: [
        'Стільки можливостей у каталозі позначені за життєвою ситуацією дитини: ВПО, інвалідність, діти ветеранів і загиблих захисників, онкозахворювання, малозабезпечені родини, сироти.',
        '',
        'Такого фільтра немає більше ніде в Україні. Бо саме цим родинам найважче знайти те, що для них.',
      ],
    },
  ];

  // Порожню картку пропускаємо й беремо наступну: інакше формат тихо
  // відкочувався в дайджест, і «цифра дня» ніколи не виходила.
  let card = null;
  for (let i = 0; i < CARDS.length; i += 1) {
    const c = CARDS[(weekIndex + i) % CARDS.length];
    if (c.value) { card = c; break; }
  }
  if (!card) return null;
  return [
    `📊 <b>${card.value}</b>`,
    '',
    ...card.text,
    '',
    '👉 <a href="https://dityam.com.ua">dityam.com.ua</a>',
  ];
}

/** Скільки безкоштовних у пулі — для підпису під ситуацією. */
function freeCountForPost(pool) {
  return pool.filter((r) => r.cost_type === 'free').length;
}

function ageLabel(r) {
  if (r.age_from == null || r.age_to == null) return null;
  if (r.age_from === 0 && r.age_to >= 17) return '0–18 років';
  // age_to=18 = молодіжна програма без реального ліміту до 17 → "від X р."
  if (r.age_to >= 18 && r.age_from > 0) return `від ${r.age_from} р.`;
  if (r.age_from === r.age_to) return `${r.age_from} років`;
  return `${r.age_from}–${r.age_to} років`;
}

// Типи, де дата в полі deadline — це не «останній день подачі», а день,
// коли воно відбувається. Для них «Дедлайн» — брехня: подія не закривається,
// вона просто настає. competition сюди свідомо НЕ входить: у конкурсів дата
// майже завжди означає останній день подачі роботи.
const EVENT_TYPES = new Set([
  'camp', 'festival', 'excursion', 'conference', 'hackathon',
  'workshop', 'sport_tournament', 'summer_school',
]);

// Заповнений event_end_date — це вже пряма ознака датованої події, хоч би
// який був тип: його ставлять саме тим записам, що мають день проведення.
const isEvent = (r) => EVENT_TYPES.has(r.opportunity_type) || Boolean(r.event_end_date);

// Один рядок про дату — «Коли» для подій, «Дедлайн» для подачі.
// Для подій навмисно не пишемо «за 3 дн.»: у події важлива сама дата, бо
// її треба вписати в календар, а не встигнути до неї.
// Діапазон дат події. Коли місяць і рік збігаються, не повторюємо їх двічі:
// «12 — 15 вересня 2026» замість «12 вересня 2026 — 15 вересня 2026».
function formatDateRange(fromStr, toStr) {
  const from = formatDeadlineDate(fromStr);
  if (!from) return null;
  const to = formatDeadlineDate(toStr);
  if (!to || to === from) return from;
  const a = new Date(fromStr);
  const b = new Date(toStr);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} — ${to}`;
  }
  return `${from} — ${to}`;
}

function whenLine(r, indent = '') {
  if (isEvent(r)) {
    const when = formatDateRange(r.deadline, r.event_end_date);
    if (!when) return null;
    return `${indent}📅 Коли: <b>${when}</b>`;
  }
  if (r.daysLeft != null && r.daysLeft >= 0) {
    const tag = r.daysLeft === 0 ? 'сьогодні' : r.daysLeft === 1 ? 'завтра' : `за ${r.daysLeft} дн.`;
    return `${indent}⏰ Дедлайн: <b>${tag}</b>`;
  }
  const dl = formatDeadlineDate(r.deadline);
  return dl ? `${indent}⏰ Дедлайн: <b>${dl}</b>` : null;
}

function formatDeadlineDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatLine(r, index) {
  const url = `https://dityam.com.ua/o/${r.slug}`;
  const typeLabel = TYPE_LABELS[r.opportunity_type];
  const age = ageLabel(r);

  // Meta line — same emoji format as individual posts
  const meta = [];
  if (typeLabel) meta.push(`📚 ${typeLabel}`);
  if (age) meta.push(`👶 ${age}`);
  if (r.cost_type === 'free') meta.push('✅ Безкоштовно');
  else if (r.cost_type === 'partially_free') meta.push('💳 З фінансуванням');
  else if (r.cost_type === 'paid_affordable') meta.push('💳 Доступно');
  else if (r.cost_type === 'paid_premium') meta.push('💳 Преміум');
  else if (r.cost_type === 'subsidized') meta.push('💳 Субсидовано');

  const prefix = `${(index ?? 0) + 1}.`;
  const lines = [`${prefix} <a href="${url}"><b>${escapeHtml(r.title)}</b></a>`];
  if (meta.length) lines.push(`   ${meta.join(' · ')}`);

  // Рядок дати: «Коли» для подій, «Дедлайн» для подачі.
  const whenLineText = whenLine(r, '   ');
  if (whenLineText) lines.push(whenLineText);

  // Full description (up to 500 chars, same as individual post)
  if (r.summary) {
    const s = r.summary.replace(/\s+/g, ' ').trim();
    const sum = s.length > 500 ? `${s.slice(0, 500)}…` : s;
    lines.push(`   <i>${escapeHtml(sum)}</i>`);
  }

  return lines.join('\n');
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

process.exit(failed > 0 ? 1 : 0);
