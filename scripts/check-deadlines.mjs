/**
 * Daily deadline check.
 *
 * Closing expired opportunities moved to scraper/lifecycle.py on 17.09.2026:
 * it decides by the opportunity's timing kind (one-time / periodic /
 * permanent) and schedules the next check, instead of guessing by type.
 *
 * Prints (and writes to artifact) a report with stats and the items that
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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planEntryFor, kyivIso, addDays, FALLBACK_TOPIC, SITUATION_TEXTS } from './channel-plan.mjs';
import { resolveTokens } from './telegram-counters.mjs';
import { verifyBeforePost } from './verify-before-post.mjs';
import { costLabel, deadlineTag, formatDeadlineDate, isUkrainianPost, placeText } from './post-labels.mjs';

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
// в базі. PREVIEW_DAYS — на скільки днів уперед показати план (типово 14).
const PREVIEW = process.env.PREVIEW === 'true';
// Який пост надсилає цей запуск (17.09.2026, рішення Марії «рознести в часі»):
//   digest — лише щоденний тематичний (ранковий запуск);
//   new    — лише «🆕 Нова можливість» (вечірній запуск);
//   both   — обидва поспіль (ручний запуск і превʼю, як було до 17.09).
// Раніше обидва пости йшли одним запуском з різницею в секунду: 17.09 вони
// прийшли разом о 13:49 замість 09:00, бо GitHub запустив розклад на 5 годин
// пізніше. Новинка, що вже вийшла в ранковому пості, ввечері не повториться:
// її telegram_posted_at уже стоїть.
const POST = ['digest', 'new'].includes(process.env.POST) ? process.env.POST : 'both';
const PREVIEW_DAYS = Number(process.env.PREVIEW_DAYS || 14);

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

// Чи можна цей запис показувати людям. Рівно ті самі два фільтри, що й у
// публічній вибірці сайту (lib/supabase.js): активний і не дубль.
//
// Навіщо окремо. Головний запит цього скрипта свідомо бере ВСІ статуси —
// він же й архівує прострочене, тож мусить бачити і draft, і closed. Але
// його результат ішов просто в пост, і в канал 29.08 потрапили три картки
// зі статусом draft: люди клікали й отримували 404, бо сайт чернетки не
// показує. Тобто канал публікував ще не перевірене.
const isPublishable = (r) => r.status === 'active' && !r.canonical_slug;

const { data, error } = await supabase
  .from('opportunities')
  .select('id, slug, title, summary, opportunity_type, age_from, age_to, deadline, event_start_date, event_end_date, results_date, cost_type, status, canonical_slug, source_url')
  .not('deadline', 'is', null)
  .lte('deadline', lookahead.toISOString().slice(0, 10));

if (error) {
  console.error('Supabase select error:', error);
  process.exit(1);
}

// Закриття за датою з 17.09.2026 живе в scraper/lifecycle.py («Планові
// перевірки»). Тут воно вирішувалось за типом: конкурси й гранти з минулим
// дедлайном лишались активними як «щорічні» (стирався лише дедлайн), а
// олімпіади, закриті за датою події, не отримували дати повторної перевірки
// і зникали назавжди. Тепер рішення залежить від виду можливості, і дата
// наступної перевірки ставиться там само. Цей скрипт лишає звіт і пост.
const dueSoon = [];            // 0..30 days, just for report

for (const row of data || []) {
  const dl = new Date(row.deadline);
  dl.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((dl - today) / 86400000);
  if (daysLeft >= 0) dueSoon.push({ ...row, daysLeft });
}

dueSoon.sort((a, b) => a.daysLeft - b.daysLeft);

console.log(`Deadline check — ${stamp}${DRY_RUN ? ' (DRY RUN)' : ''}`);
console.log('='.repeat(60));
console.log(`Due soon: ${dueSoon.length}. Closing by date: scraper/lifecycle.py.`);
console.log('');

console.log(`🟢 DUE WITHIN 30 DAYS (${dueSoon.length}):`);
for (const r of dueSoon) {
  const tag = r.daysLeft <= 7 ? '⚡' : '  ';
  console.log(` ${tag} ${r.deadline}  [in ${r.daysLeft}d]  ${r.title}`);
}


// --- Persist artifact for GitHub Actions ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'output');
await mkdir(outDir, { recursive: true });

const reportLines = [
  `Deadline check — ${stamp}`,
  '='.repeat(60),
  `due-soon=${dueSoon.length} (closing by date: scraper/lifecycle.py)`,
  '',
  `Due within 30 days:`,
  ...dueSoon.map((r) => `  ${r.deadline} [in ${r.daysLeft}d]  ${r.title}`),
];
await writeFile(join(outDir, `deadline-report-${stamp}.txt`), reportLines.join('\n'), 'utf8');

// Declared before sendDailyDigest's invocation so the consts are initialized
// (TDZ would throw otherwise — JS hoists `const` declarations but keeps them
// uninitialized until execution reaches the declaration line).
//
// Тема дня — з плану каналу (scripts/channel-plan.mjs), а не з дня тижня.
// Можливість, що вже виходила в каналі, не повторюється REPEAT_DAYS днів:
// за 20 постів до 16.09.2026 шість можливостей вийшли двічі, майже всі —
// у «Дедлайн наближається» в сусідні дні.
const REPEAT_DAYS = 30;
const repeatCutoff = new Date(Date.now() - REPEAT_DAYS * 86400000).toISOString();
// Превʼю нічого не пише в базу, тож «уже показане» тримаємо в памʼяті —
// інакше превʼю на 14 днів показувало б ті самі можливості щодня.
const shownInPreview = new Set();
const SUPPORT_LINE = '🧡 Платформа безкоштовна і живе без реклами. Підтримати — <a href="https://send.monobank.ua/jar/F72fDrV2c">банка monobank</a> або <a href="https://dityam.com.ua/support">інші способи</a>.';
// Dityam+ продає не доступ, а роботу: відбір, нагадування, допомогу із
// заявкою. Тому в каналі не тизер «що ви пропустили», а пропозиція зняти
// з людини рутину. Усе з поста лишається відкритим для всіх.
// Веде ПРЯМО в бот, а не на сторінку /plus: доти людина з поста мусила
// відкрити сайт, знайти там кнопку й аж тоді дійти до бота — три кліки на
// рівному місці (Марія, 25.09.2026). Мітка `from_<звідки>` показує, який
// формат поста приводить людей: бот записує її в digest_subscribers.source.
const plusLine = (where) => '⚡ Не встигаєте стежити за дедлайнами? '
  + `<a href="https://t.me/DityamPlusBot?start=from_${where}">Dityam+</a> відбере ваші й нагадає вчасно.`;
// Теги, які Telegram приймає в parse_mode=HTML (як у post-message.mjs).
const ALLOWED_TAGS = /^(b|strong|i|em|u|s|code|pre|a|blockquote|tg-spoiler)$/;
const POOL_COLUMNS = 'id, slug, title, summary, details, source, opportunity_type, age_from, age_to, '
  + 'cost_type, deadline, event_start_date, event_end_date, results_date, created_at, telegram_posted_at, child_needs, cities, '
  + 'countries, is_international, format, aid_type';

// Ситуації для формату «situation»: починаємо з болю батьків, а не з програми.
// Яка ситуація в який день — у плані каналу.
//
// Кожен фільтр мусить відповідати на САМУ ситуацію, а не лише на вік і ціну.
// 14.09.2026 під «дитині 15, хоче спробувати щось своє» пішов фонд допомоги
// онкохворим дітям: фільтр перевіряв тільки «безкоштовно» і «до 14+», а тип
// запису — ні. Під пост пишемо «за які не треба платити», тож безкоштовність
// перевіряється окремо для всіх ситуацій у sendDailyDigest.
// Рядки — у channel-plan.mjs (їх читає ще й адмінка), тут лише фільтри.
const SITUATIONS = [
  {
    text: SITUATION_TEXTS[0],
    filter: (r) => r.age_from <= 15 && r.age_to >= 15
      && ['club', 'course', 'workshop', 'competition', 'hackathon', 'festival', 'mentorship', 'volunteer']
        .includes(r.opportunity_type),
  },
  {
    text: SITUATION_TEXTS[1],
    filter: (r) => r.cost_type === 'free' && ['club', 'camp', 'course', 'competition'].includes(r.opportunity_type),
  },
  {
    text: SITUATION_TEXTS[2],
    // Тип «конкурс» надто широкий — під нього підпадають і спортивні
    // змагання. Тому додатково звіряємося зі словами в назві й описі.
    filter: (r) => ['olympiad', 'competition', 'hackathon'].includes(r.opportunity_type)
      && /(математик|фізик|хімі|біолог|інформатик|наук|stem|дослідн|інженер|винахід|програм)/i
        .test(`${r.title || ''} ${r.summary || ''}`),
  },
  {
    text: SITUATION_TEXTS[3],
    filter: (r) => ['exchange', 'study_abroad', 'scholarship'].includes(r.opportunity_type),
  },
  {
    text: SITUATION_TEXTS[4],
    filter: (r) => r.age_from <= 3 && r.cost_type === 'free',
  },
  {
    text: SITUATION_TEXTS[5],
    filter: (r) => ['festival', 'competition', 'club', 'workshop'].includes(r.opportunity_type),
  },
];

// --- Optional: notify Telegram with daily digest ---
if (PREVIEW) {
  // Вичитка: пости на PREVIEW_DAYS днів уперед за планом, нічого не шлючи.
  const start = kyivIso();
  for (let i = 0; i < PREVIEW_DAYS; i += 1) {
    const date = addDays(start, i);
    const entry = planEntryFor(date);
    console.log(`\n${'='.repeat(64)}\n${date} — день ${entry.index + 1} плану: «${entry.key}» (${entry.kind})\n${'='.repeat(64)}`);
    const shown = await sendDailyDigest(date);
    await sendNewOpportunityPost(shown);
  }
// DRY_RUN тепер теж збирає пост — і друкує його замість відправки
// (postToChannel), нічого не позначаючи як опубліковане. До 20.09.2026 сухий
// прогін завершувався на звіті, тож перевірити добір і ворота публікації перед
// змінами в проді було ніяк.
} else if (NOTIFY && TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
  const shown = POST === 'new' ? [] : await sendDailyDigest();
  if (POST !== 'digest') await sendNewOpportunityPost(shown || []);
}

/** Щоденний пост за планом каналу. Повертає id можливостей, які в нього потрапили. */
async function sendDailyDigest(dateIso = kyivIso()) {
  const entry = planEntryFor(dateIso);

  // Посторінково: PostgREST віддає максимум 1000 рядків, а відкритих записів
  // уже понад тисячу — без цього частина тихо не потрапляла б у добір.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data: page, error: poolErr } = await supabase
      .from('opportunities')
      .select(POOL_COLUMNS)
      .eq('status', 'active')
      .is('canonical_slug', null)
      .or(`deadline.is.null,deadline.gte.${minLeadIso}`)
      .order('id')
      .range(from, from + 999);
    if (poolErr) {
      console.error(`Pool fetch failed: ${poolErr.message}`);
      return [];
    }
    rows.push(...(page || []));
    if (!page || page.length < 1000) break;
  }

  // Дні до дедлайну рахуємо від дати поста: у превʼю це дні наперед.
  const dayMs = Date.parse(`${dateIso}T00:00:00Z`);
  const pool = rows
    .map((r) => ({
      ...r,
      daysLeft: r.deadline ? Math.round((Date.parse(`${r.deadline}T00:00:00Z`) - dayMs) / 86400000) : null,
    }))
    .filter((r) => r.daysLeft == null || r.daysLeft >= MIN_LEAD_DAYS);
  // Лише українською: запис англійською чекає перекладу (post-labels.isUkrainianPost).
  const eligible = pool.filter((r) => !shownInPreview.has(r.id)
    && !(r.telegram_posted_at && r.telegram_posted_at >= repeatCutoff)
    && isUkrainianPost(r));

  let built = await buildPlannedPost(entry, pool, eligible);
  if (!built) {
    console.log(`План «${entry.key}»: не вистачило записів — запасна тема «${FALLBACK_TOPIC.key}».`);
    built = await buildPlannedPost(FALLBACK_TOPIC, pool, eligible);
  }
  if (!built) {
    console.log('Nothing to post — навіть запасна тема порожня.');
    return [];
  }
  const sent = await postToChannel(built.lines, `${entry.key}: ${built.label}`);
  if (sent || PREVIEW) await markPosted(built.items);
  return built.items.map((r) => r.id);
}

/**
 * Пост за записом плану. null — якщо для теми не набралось записів
 * (тоді виходить запасна тема) або готовий файл не пройшов перевірку.
 */
async function buildPlannedPost(entry, pool, eligible) {
  if (entry.kind === 'digest') {
    const items = await pickChecked(rankItems(eligible, entry.match), 3, entry.key);
    if (items.length < 2) return null;
    const lines = [`<b>${entry.heading}</b>`];
    if (entry.description) lines.push(`<i>${entry.description}</i>`);
    lines.push('');
    items.forEach((r, i) => {
      lines.push(formatLine(r, i));
      if (i < items.length - 1) lines.push('');
    });
    lines.push('', `👉 Більше — <a href="${entry.link}">на dityam.com.ua</a>`, '', plusLine('channel_topic'));
    return { lines, items, label: `digest ${items.length}` };
  }

  if (entry.kind === 'story') {
    const [hero] = await pickChecked(rankItems(eligible, entry.match), 1, entry.key);
    if (!hero) return null;
    return { lines: [entry.heading, '', ...buildStoryPost(hero, entry.link)], items: [hero], label: `story ${hero.slug}` };
  }

  if (entry.kind === 'deadlines') {
    const soon = eligible
      .filter((r) => r.daysLeft != null && r.daysLeft <= 14)
      .sort((a, b) => a.daysLeft - b.daysLeft);
    const items = await pickChecked(soon, 5, 'дедлайни');
    if (items.length < 2) return null;
    const lines = [`<b>${entry.heading}</b>`, `<i>${entry.description}</i>`, ''];
    items.forEach((r, i) => {
      lines.push(formatLine(r, i));
      if (i < items.length - 1) lines.push('');
    });
    lines.push('', `👉 Усі дедлайни — <a href="${entry.link}">на dityam.com.ua</a>`, '', plusLine('channel_deadlines'));
    return { lines, items, label: `deadlines ${items.length}` };
  }

  if (entry.kind === 'situation') {
    const situation = SITUATIONS[entry.situation];
    // Безкоштовність — для всіх ситуацій: рядок нижче обіцяє «за які не треба
    // платити», а фільтри про математику, поїздки й малювання ціну не
    // перевіряли.
    const picks = await pickChecked(
      shuffle(eligible.filter((r) => r.cost_type === 'free' && situation.filter(r))), 3, 'ситуація');
    if (picks.length < 2) return null;
    const lines = [`<b>${situation.text}</b>`, ''];
    lines.push(`${picks.length === 3 ? 'Три варіанти' : 'Ось варіанти'}, за які не треба платити:`);
    lines.push('');
    picks.forEach((r, i) => {
      lines.push(formatLine(r, i));
      if (i < picks.length - 1) lines.push('');
    });
    lines.push('', `👉 Ще ${freeCountForPost(pool)} безкоштовних — на <a href="https://dityam.com.ua">dityam.com.ua</a>`);
    return { lines, items: picks, label: 'situation' };
  }

  if (entry.kind === 'number') {
    const lines = buildNumberPost(pool, entry.card);
    if (!lines) return null;
    lines.push('', SUPPORT_LINE);
    return { lines, items: [], label: 'number' };
  }

  if (entry.kind === 'file') {
    // Числа в готовому тексті не пишуться руками — підставляються з бази зараз
    // (scripts/telegram-counters.mjs).
    try {
      const raw = (await readFile(join(__dirname, '..', 'content', 'telegram', entry.file), 'utf8')).trim();
      const { text } = await resolveTokens(raw, { url: SUPABASE_URL, key: SUPABASE_KEY });
      const bad = [...text.matchAll(/<\/?([a-zA-Z-]+)[^>]*>/g)]
        .map((m) => m[1].toLowerCase())
        .filter((tag) => !ALLOWED_TAGS.test(tag));
      const length = text.replace(/<[^>]+>/g, '').length;
      if (bad.length || length > 4096) {
        console.error(`Файл ${entry.file}: теги ${[...new Set(bad)].join(', ') || '—'}, ${length} символів.`);
        return null;
      }
      return { lines: [text], items: [], label: `file ${entry.file}` };
    } catch (e) {
      console.error(`Файл ${entry.file}: ${e.message}`);
      return null;
    }
  }

  return null;
}

/**
 * Добір для теми: спершу безкоштовні, серед них — із найближчим дедлайном,
 * далі без дати у випадковому порядку; платні — лише якщо безкоштовних
 * забракло. Канал читають заради безкоштовного: за 30 днів до 15.09.2026 на
 * безкоштовні програми припало 410 із 479 кліків зі сторінок можливостей.
 */
function rankItems(eligible, match) {
  const matched = eligible.filter(match);
  const dated = matched.filter((r) => r.daysLeft != null).sort((a, b) => a.daysLeft - b.daysLeft);
  const undated = shuffle(matched.filter((r) => r.daysLeft == null));
  const rank = (r) => (r.cost_type === 'free' ? 0 : 1);
  return [...dated, ...undated].sort((a, b) => rank(a) - rank(b));
}

/**
 * Скільки треба — стільки й беремо, але кожну кандидатку спершу перевіряємо на
 * сторінці джерела (scripts/verify-before-post.mjs). Та, що не пройшла, поста
 * не скорочує: беремо наступну з черги, кандидатів завжди більше, ніж місць.
 *
 * 20.09.2026 у канал пішла «Літня ІТ-школа Star for Life Ukraine»: назву взяли
 * 12 липня, школа скінчилась 20 серпня, а сторінка джерела стала бібліотекою
 * курсів. Перевірка лінка бачила 200 і мовчала. Тепер перед постом читається
 * сама сторінка.
 */
async function pickChecked(candidates, need, label) {
  const chosen = [];
  let i = 0;
  while (chosen.length < need && i < candidates.length) {
    const batch = candidates.slice(i, i + (need - chosen.length));
    i += batch.length;
    const { items } = await verifyBeforePost(batch, { label });
    chosen.push(...items);
  }
  return chosen;
}

/** Відправка в канал. Один шлях для всіх форматів поста. true — пост пішов. */
async function postToChannel(lines, label) {
  const text = lines.join('\n');
  if (DRY_RUN || PREVIEW) {
    console.log(`\n--- ПОСТ [${label}] ---\n${text}\n--- /ПОСТ ---`);
    return false;
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
    if (json.ok) {
      console.log(`📨 Пост надіслано — ${label}.`);
      return true;
    }
    console.error(`Telegram error: ${json.description}`);
  } catch (e) {
    console.error(`Telegram send failed: ${e.message}`);
  }
  return false;
}

/** Формат «story»: одна можливість розгорнуто. link — «схожі можливості». */
function buildStoryPost(r, link = null) {
  const url = `https://dityam.com.ua/o/${r.slug}`;
  const lines = [`<b>${escapeHtml(r.title)}</b>`, ''];

  if (r.summary) lines.push(escapeHtml(r.summary.slice(0, 400)));
  lines.push('');

  const age = ageLabel(r);
  if (age) lines.push(`👶 Для кого: ${age}`);
  const typeLabel = TYPE_LABELS[r.opportunity_type];
  if (typeLabel) lines.push(`📚 Формат: ${typeLabel}`);
  const place = placeText(r);
  if (place) lines.push(`📍 Де: ${escapeHtml(place)}`);
  // «Скільки коштує: нічого» стояло в 12 постах каналу до 22.09.2026 — Марія:
  // «як можна писати нічого… пиши безкоштовно». Той самий підпис, що в дайджестах.
  if (r.cost_type === 'free') lines.push(`✅ ${costLabel('free')}`);

  // Без дати рядка немає. «Дедлайну немає — набір триває» тут писати не можна:
  // часто це означає «набір ще не оголошено» — як у «Володаря стихій» 15.09.2026,
  // де реєстрацію фонд оголошує у своїх соцмережах.
  const when = whenLine(r);
  if (when) lines.push(when);

  lines.push('');
  lines.push(`👉 <a href="${url}">Умови й подача — на dityam.com.ua</a>`);
  if (link) lines.push(`🔗 Схожі можливості — <a href="${link}">тут</a>`);
  return lines;
}

/** Формат «number»: одна цифра, яка щось означає. startCard — з плану каналу. */
function buildNumberPost(pool, startCard) {
  const free = pool.filter((r) => r.cost_type === 'free').length;
  const sources = new Set(pool.map((r) => r.source).filter(Boolean)).size;
  const withNeeds = pool.filter((r) => (r.child_needs || []).length > 0).length;

  const CARDS = [
    {
      value: free,
      text: [
        'Стільки безкоштовних можливостей для дітей відкрито просто зараз: гуртки, табори, олімпіади, стипендії, виплати.',
        '',
        'Це не оцінка, а точне число з платформи на сьогодні. Вони працюють, і вони справді безкоштовні.',
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
        'Стільки можливостей на платформі позначені за життєвою ситуацією дитини: ВПО, інвалідність, діти захисників і захисниць, онкозахворювання, малозабезпечені родини, сироти.',
        '',
        'Такого фільтра немає більше ніде в Україні. Бо саме цим родинам найважче знайти те, що для них.',
      ],
    },
  ];

  // Порожню картку пропускаємо й беремо наступну: інакше формат тихо
  // відкочувався в дайджест, і «цифра дня» ніколи не виходила.
  let card = null;
  for (let i = 0; i < CARDS.length; i += 1) {
    const c = CARDS[(startCard + i) % CARDS.length];
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

/**
 * «🆕 Нова можливість» — окремий пост; з 17.09.2026 — окремим вечірнім запуском.
 * 15.09.2026 блок у кінці щоденного поста губився, тож за рішенням Марії
 * новинка завжди йде окремо. Одна на день: окремі картки на кожну новинку
 * (до 8 за запуск) вимкнули 19.08 як спам.
 * Нова — додана за останні три дні й ще не була в каналі. telegram_posted_at
 * ставиться лише після відправки, тож двічі «новою» вона не вийде, а запис,
 * доданий між запусками, не загубиться, хоч розклад GitHub і зсуває запуск.
 * excludeIds — те, що вже є в щоденному пості цього дня.
 */
async function sendNewOpportunityPost(excludeIds = []) {
  const since = new Date(Date.now() - 3 * 86400000).toISOString();
  const { data, error } = await supabase
    .from('opportunities')
    .select('id, slug, title, summary, opportunity_type, age_from, age_to, cost_type, deadline, event_start_date, event_end_date, results_date, created_at, cities, countries, is_international, format')
    .eq('status', 'active')
    .is('canonical_slug', null)
    .is('telegram_posted_at', null)
    .gte('created_at', since)
    .or(`deadline.is.null,deadline.gte.${minLeadIso}`)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) {
    console.error(`New opportunity fetch failed: ${error.message}`);
    return;
  }
  const fresh = (data || []).filter((x) => !excludeIds.includes(x.id) && !shownInPreview.has(x.id)
    && isUkrainianPost(x));
  const [r] = await pickChecked(fresh, 1, 'нова можливість');
  if (!r) {
    console.log('Нової можливості для окремого поста немає.');
    return;
  }
  const lines = ['🆕 <b>Нова можливість</b>', '', ...buildStoryPost(r)];
  const sent = await postToChannel(lines, `new (${r.slug})`);
  if (sent || PREVIEW) await markPosted([r]);
}

async function markPosted(items) {
  if (items.length === 0) return;
  if (PREVIEW) {
    items.forEach((r) => shownInPreview.add(r.id));
    return;
  }
  const { error } = await supabase
    .from('opportunities')
    .update({ telegram_posted_at: new Date().toISOString() })
    .in('id', items.map((r) => r.id));
  if (error) console.error(`telegram_posted_at не збережено: ${error.message}`);
}

function ageLabel(r) {
  if (r.age_from == null || r.age_to == null) return null;
  if (r.age_from === 0 && r.age_to >= 17) return '0–18 років';
  // age_to=18 = молодіжна програма без реального ліміту до 17 → "від X р."
  if (r.age_to >= 18 && r.age_from > 0) return `від ${r.age_from} р.`;
  if (r.age_from === r.age_to) return `${r.age_from} років`;
  return `${r.age_from}–${r.age_to} років`;
}

// Один рядок про дату — «Коли» для подій, «Заявки до» для подачі. Для подій
// лише дата: її треба вписати в календар, а не встигнути до неї. Для подачі —
// дата й скільки лишилось (post-labels.mjs).
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

// Дві РІЗНІ дати — два різні рядки. До 17.09.2026 тут для подій друкувалось
// formatDateRange(r.deadline, r.event_end_date): дедлайн подачі ставав
// «початком» події. Саме так пішов пост про сесію ЄМП у Мальме («Коли:
// 17 вересня — 8 листопада» при справжніх 6–8 листопада). У post-to-telegram
// це виправили 16.09, але щоденний пост робить цей скрипт.
function whenLine(r, indent = '') {
  const lines = [];
  const when = formatDateRange(r.event_start_date || r.event_end_date, r.event_end_date);
  if (when) lines.push(`${indent}📅 Коли: <b>${when}</b>`);
  // Одноденна подія з дедлайном того ж дня — лише «Коли», без повтору дати.
  const sameDay = r.deadline && r.event_start_date === r.deadline
    && (r.event_end_date || r.event_start_date) === r.deadline;
  // Розіграш чи оголошення переможців — окремий рядок (з 17.09.2026): до цього
  // дата розіграшу потрапляла і в «Коли», і в «Заявки до».
  const results = formatDeadlineDate(r.results_date);
  if (results) lines.push(`${indent}🏆 Результати: <b>${results}</b>`);
  if (r.deadline && !sameDay) {
    const tag = deadlineTag(r.deadline, r.daysLeft);
    if (tag) lines.push(`${indent}⏰ Заявки до: ${tag}`);
  }
  return lines.length ? lines.join('\n') : null;
}

function formatLine(r, index) {
  const url = `https://dityam.com.ua/o/${r.slug}`;
  const typeLabel = TYPE_LABELS[r.opportunity_type];
  const age = ageLabel(r);

  // Meta line — same emoji format as individual posts
  const meta = [];
  if (typeLabel) meta.push(`📚 ${typeLabel}`);
  if (age) meta.push(`👶 ${age}`);
  const cost = costLabel(r.cost_type);
  if (cost) meta.push(`${r.cost_type === 'free' ? '✅' : '💳'} ${cost}`);
  const place = placeText(r);
  if (place) meta.push(`📍 ${escapeHtml(place)}`);

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

process.exit(0);
