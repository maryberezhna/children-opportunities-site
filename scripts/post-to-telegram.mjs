import { createClient } from '@supabase/supabase-js';
import { verifyBeforePost } from './verify-before-post.mjs';
import { costLabel } from './post-labels.mjs';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const MAX_PER_RUN = Number(process.env.MAX_PER_RUN || 8);
// Diversity controls: cap how many of the SAME type go out in one batch, and
// how large a candidate pool to diversify from. Prevents the channel from being
// flooded with near-identical posts (e.g. dozens of «Всеукраїнська олімпіада з …»).
const MAX_PER_TYPE = Number(process.env.MAX_PER_TYPE || 2);
const POOL_SIZE = Number(process.env.POOL_SIZE || 80);
const DRY_RUN = process.env.DRY_RUN === 'true';
// Скільки днів має лишатись до дедлайну, щоб можливість пішла в канал.
// Пост із дедлайном «сьогодні» підписник прочитає вже після того, як подача
// закриється, — на заявку треба хоч кілька днів.
const MIN_LEAD_DAYS = Number(process.env.MIN_LEAD_DAYS || 3);

const required = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
};
for (const [name, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
}

const TYPE_LABELS = {
  course: 'Курс',
  workshop: 'Майстер-клас',
  summer_school: 'Літня школа',
  study_program: 'Навчальна програма',
  mentorship: 'Менторство',
  club: 'Гурток',
  camp: 'Табір',
  olympiad: 'Олімпіада',
  competition: 'Конкурс',
  hackathon: 'Хакатон',
  sport_tournament: 'Спорт. турнір',
  festival: 'Фестиваль',
  award: 'Премія',
  exchange: 'Обмін',
  excursion: 'Екскурсія',
  residency: 'Резиденція',
  scholarship: 'Стипендія',
  grant: 'Грант',
  allowance: 'Виплата',
  support_payment: 'Соц. виплата',
  internship: 'Стажування',
  volunteer: 'Волонтерство',
  conference: 'Конференція',
  medical_aid: 'Мед. допомога',
  psychology: 'Психологія',
  rehabilitation: 'Реабілітація',
  humanitarian: 'Гум. допомога',
  legal_aid: 'Правова допомога',
  shelter: 'Прихисток',
  educational_material: 'Навч. матеріали',
  study_abroad: 'Навчання за кордоном',
  sport_event: 'Спорт',
};


function ageLabel(item) {
  if (item.age_from === 0 && item.age_to >= 17) return '0–18 років';
  if (item.age_to >= 18 && item.age_from > 0) return `від ${item.age_from} р.`;
  if (item.age_from === item.age_to) return `${item.age_from} років`;
  return `${item.age_from}–${item.age_to} років`;
}

// «Коли» для подій, «Дедлайн» для подачі.
// Діапазон дат події. Коли місяць і рік збігаються, не повторюємо їх двічі:
// «12 — 15 вересня 2026» замість «12 вересня 2026 — 15 вересня 2026».
function formatDateRange(fromStr, toStr) {
  const from = formatDeadline(fromStr);
  if (!from) return null;
  const to = formatDeadline(toStr);
  if (!to || to === from) return from;
  const a = new Date(fromStr);
  const b = new Date(toStr);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} — ${to}`;
  }
  return `${from} — ${to}`;
}

// Дві РІЗНІ дати — два різні рядки, і вони не замінюють одна одну.
//
// Було: одна функція на обидва випадки. Якщо в записі стояв event_end_date,
// вона брала deadline за ПОЧАТОК події і зшивала їх у діапазон. Так у канал
// пішло «📅 Коли: 17 вересня — 8 листопада» про сесію ЄМП у Мальме, яка
// насправді триває 6–8 листопада, а 17 вересня — останній день ПОДАЧІ.
// А шість постів про закордонні табори (SHAD, MIT Launch, CISV, GYLC…)
// узагалі називали «днем проведення» сам дедлайн подачі.
//
// Тепер «коли відбувається» читається з event_start_date / event_end_date,
// «до коли подати» — з deadline, і в пості може бути як один рядок, так і
// обидва. Порожнє поле дає порожній рядок, а не вигаданий діапазон.
function whenLines(item) {
  const lines = [];
  const when = formatDateRange(item.event_start_date, item.event_end_date);
  if (when) lines.push(`📅 Коли: <b>${when}</b>`);
  const results = formatDeadline(item.results_date);
  if (results) lines.push(`🏆 Результати: <b>${results}</b>`);
  const sameDay = item.deadline && item.event_start_date === item.deadline
    && (item.event_end_date || item.event_start_date) === item.deadline;
  const deadline = formatDeadline(item.deadline);
  if (deadline && !sameDay) lines.push(`⏰ Заявки до: <b>${deadline}</b>`);
  return lines;
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// A/B тексту посту. Варіант виводиться з id можливості, а не з випадкового числа:
// перезапуск воркфлоу на тому самому записі має дати той самий текст, інакше
// голоси 👍/👎 неможливо чесно віднести до варіанта.
// DIGEST_AB=off — вимкнути експеримент і завжди слати 'a'.
function pickVariant(opportunityId) {
  if (process.env.DIGEST_AB === 'off') return 'a';
  const hex = String(opportunityId).replace(/[^0-9a-f]/gi, '').slice(-1);
  const n = parseInt(hex, 16);
  return Number.isNaN(n) || n % 2 === 0 ? 'a' : 'b';
}

// A — розгорнутий: повний опис, «🆕» лідер. Це історичний формат.
function buildMessageA(item) {
  const typeLabel = TYPE_LABELS[item.opportunity_type] || item.opportunity_type;
  const cost = costLabel(item.cost_type);
  const deadline = formatDeadline(item.deadline);
  const url = `${SITE_URL}/o/${item.slug}`;

  const lines = [];
  lines.push(`🆕 <b>${escapeHtml(item.title)}</b>`);
  lines.push('');

  const meta = [`📚 ${typeLabel}`, `👶 ${ageLabel(item)}`];
  if (cost) meta.push(`${item.cost_type === 'free' ? '✅' : '💳'} ${cost}`);
  lines.push(meta.join(' · '));

  lines.push(...whenLines(item));
  if (item.format) lines.push(`📍 ${escapeHtml(item.format)}`);

  if (item.summary) {
    const summary = item.summary.length > 500
      ? `${item.summary.slice(0, 500)}…`
      : item.summary;
    lines.push('');
    lines.push(escapeHtml(summary));
  }

  lines.push('');
  lines.push(`🔗 <a href="${url}">Деталі на dityam.com.ua</a>`);

  return lines.join('\n');
}

// B — стислий: опис до 180 символів, «✨» лідер, дедлайн у тому ж рядку меты.
// Гіпотеза: у стрічці каналу коротший пост читають до кінця частіше.
function buildMessageB(item) {
  const typeLabel = TYPE_LABELS[item.opportunity_type] || item.opportunity_type;
  const cost = costLabel(item.cost_type);
  const deadline = formatDeadline(item.deadline);
  const url = `${SITE_URL}/o/${item.slug}`;

  const lines = [];
  lines.push(`✨ <b>${escapeHtml(item.title)}</b>`);

  const meta = [typeLabel, ageLabel(item)];
  if (cost) meta.push(cost);
  // Дати проведення і дедлайн подачі — різні факти. У стислому варіанті вони
  // стоять поруч у тому ж рядку меты, але не підмінюють одне одного: «6 — 8
  // листопада · подача до 17 вересня».
  const when = formatDateRange(item.event_start_date, item.event_end_date);
  if (when) meta.push(when);
  if (deadline) meta.push(`подача до ${deadline}`);
  lines.push(meta.join(' · '));

  if (item.summary) {
    const short = item.summary.length > 180
      ? `${item.summary.slice(0, 180).trimEnd()}…`
      : item.summary;
    lines.push('');
    lines.push(escapeHtml(short));
  }

  lines.push('');
  lines.push(`<a href="${url}">Деталі →</a>`);

  return lines.join('\n');
}

function buildMessage(item, variant) {
  return variant === 'b' ? buildMessageB(item) : buildMessageA(item);
}

// Кнопки «Додати в календар» тут немає: додавання дедлайну в календар —
// частина Dityam+, і ставить її бот під персональною добіркою
// (scraper/personal_digest.py). Відкритий канал лишає тільки голос.
function buildKeyboard(opportunityId, variant) {
  const rows = [];
  // Варіант їде в callback_data, щоб вебхук зберіг його разом з голосом.
  // UUID не містить ':', тож старі кнопки без суфікса теж лишаються валідними.
  rows.push([
    { text: '👍 Цікаво', callback_data: `fb:yes:${opportunityId}:${variant}` },
    { text: '👎 Не цікаво', callback_data: `fb:no:${opportunityId}:${variant}` },
  ]);
  return { inline_keyboard: rows };
}

async function sendTelegramMessage(text, replyMarkup) {
  const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      // Preview is ON again: /o/[slug] now renders its own OG image (title, age,
      // cost, deadline), so the card carries real information per post rather
      // than repeating one shared picture. Set TELEGRAM_LINK_PREVIEW=off to revert.
      disable_web_page_preview: process.env.TELEGRAM_LINK_PREVIEW === 'off',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Telegram API error: ${json.error_code} ${json.description}`);
  }
  return json.result;
}

// Pick a diverse batch. Types are visited least-recently-posted first (so the
// feed rotates across types day to day instead of always leading with the
// biggest group — e.g. olympiads), then round-robin, oldest-first within each
// type, capped at maxPerType per run. `lastPosted` maps type → ISO timestamp of
// its most recent post (missing = never posted → highest priority).
function selectDiverse(pool, max, maxPerType, lastPosted = new Map()) {
  const groups = new Map();
  for (const it of pool) {
    const key = it.opportunity_type || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const orderedTypes = [...groups.keys()].sort((a, b) => {
    const ta = lastPosted.get(a);
    const tb = lastPosted.get(b);
    if (!ta && !tb) return 0;
    if (!ta) return -1;              // never posted → go first
    if (!tb) return 1;
    return new Date(ta) - new Date(tb); // older last-post → higher priority
  });
  const counts = new Map();
  const selected = [];
  let progressed = true;
  while (selected.length < max && progressed) {
    progressed = false;
    for (const type of orderedTypes) {
      if (selected.length >= max) break;
      if ((counts.get(type) || 0) >= maxPerType) continue;
      const item = groups.get(type).shift();
      if (!item) continue;
      selected.push(item);
      counts.set(type, (counts.get(type) || 0) + 1);
      progressed = true;
    }
  }
  return selected;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const minLead = new Date();
minLead.setHours(0, 0, 0, 0);
minLead.setDate(minLead.getDate() + MIN_LEAD_DAYS);
const minLeadIso = minLead.toISOString().slice(0, 10);

const { data: pool, error } = await supabase
  .from('opportunities')
  .select('id, slug, title, summary, opportunity_type, age_from, age_to, cost_type, format, deadline, event_start_date, event_end_date, results_date')
  .eq('status', 'active')
  .is('canonical_slug', null)
  .is('telegram_posted_at', null)
  .or(`deadline.is.null,deadline.gte.${minLeadIso}`)
  .order('created_at', { ascending: true })
  .limit(POOL_SIZE);

if (error) {
  console.error('Supabase select error:', error);
  process.exit(1);
}

// When was each type last posted? Lets us rotate to under-featured types so the
// single daily post isn't an olympiad every single day.
const { data: postedRows } = await supabase
  .from('opportunities')
  .select('opportunity_type, telegram_posted_at')
  .not('telegram_posted_at', 'is', null)
  .order('telegram_posted_at', { ascending: false })
  .limit(300);
const lastPosted = new Map();
for (const r of postedRows || []) {
  if (r.opportunity_type && !lastPosted.has(r.opportunity_type)) {
    lastPosted.set(r.opportunity_type, r.telegram_posted_at);
  }
}

// Diversify the batch so the channel doesn't get flooded with same-type posts.
// Перед відправкою читаємо сторінку джерела кожної обраної можливості
// (scripts/verify-before-post.mjs): активний статус і код 200 не означають,
// що набір іще триває. Не пройшла перевірку — не публікуємо.
const picked = selectDiverse(pool || [], MAX_PER_RUN, MAX_PER_TYPE, lastPosted);
const { items } = DRY_RUN
  ? { items: picked }
  : await verifyBeforePost(picked, { label: 'post-to-telegram' });

if (items.length === 0) {
  console.log('No new opportunities to post.');
  process.exit(0);
}

const typeSummary = items.reduce((acc, it) => {
  acc[it.opportunity_type] = (acc[it.opportunity_type] || 0) + 1;
  return acc;
}, {});
console.log(`Posting ${items.length} of ${(pool || []).length} unposted — diverse mix ${JSON.stringify(typeSummary)}${DRY_RUN ? ' (DRY RUN)' : ''}...`);

let posted = 0;
let failed = 0;

for (const item of items) {
  const variant = pickVariant(item.id);
  const message = buildMessage(item, variant);
  if (DRY_RUN) {
    console.log('---');
    console.log(`[variant ${variant}]`);
    console.log(message);
    posted += 1;
    continue;
  }

  try {
    await sendTelegramMessage(message, buildKeyboard(item.id, variant));
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({ telegram_posted_at: new Date().toISOString() })
      .eq('id', item.id);
    if (updateError) {
      console.error(`Posted "${item.slug}" but failed to mark: ${updateError.message}`);
      failed += 1;
    } else {
      posted += 1;
      console.log(`✓ ${item.slug} [variant ${variant}]`);
    }
  } catch (err) {
    console.error(`✗ ${item.slug}: ${err.message}`);
    failed += 1;
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
}

console.log(`Done: ${posted} posted, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
