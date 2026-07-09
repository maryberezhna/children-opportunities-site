import { createClient } from '@supabase/supabase-js';

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

const COST_LABELS = {
  free: 'Безкоштовно',
  partially_free: 'З фінансуванням',
  paid_affordable: 'Доступно',
  paid_premium: 'Преміум',
  closed: 'Закрита подача',
};

function ageLabel(item) {
  if (item.age_from === 0 && item.age_to >= 17) return '0–18 років';
  if (item.age_to >= 18 && item.age_from > 0) return `від ${item.age_from} р.`;
  if (item.age_from === item.age_to) return `${item.age_from} років`;
  return `${item.age_from}–${item.age_to} років`;
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

function buildMessage(item) {
  const typeLabel = TYPE_LABELS[item.opportunity_type] || item.opportunity_type;
  const cost = COST_LABELS[item.cost_type];
  const deadline = formatDeadline(item.deadline);
  const url = `${SITE_URL}/o/${item.slug}`;

  const lines = [];
  lines.push(`🆕 <b>${escapeHtml(item.title)}</b>`);
  lines.push('');

  const meta = [`📚 ${typeLabel}`, `👶 ${ageLabel(item)}`];
  if (cost) meta.push(item.cost_type === 'free' ? `✅ ${cost}` : cost);
  lines.push(meta.join(' · '));

  if (deadline) lines.push(`⏰ Дедлайн: <b>${deadline}</b>`);
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

function buildKeyboard(opportunityId, slug, deadline) {
  const rows = [];
  if (deadline) {
    rows.push([{ text: '📅 Додати в календар', url: `${SITE_URL}/events/${slug}/add` }]);
  }
  rows.push([
    { text: '👍 Цікаво', callback_data: `fb:yes:${opportunityId}` },
    { text: '👎 Не цікаво', callback_data: `fb:no:${opportunityId}` },
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
      // suppress preview — every dityam.com.ua page shares the same og-image,
      // so the auto-fetched card is identical for every post and adds no info.
      disable_web_page_preview: true,
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

const { data: pool, error } = await supabase
  .from('opportunities')
  .select('id, slug, title, summary, opportunity_type, age_from, age_to, cost_type, format, deadline')
  .is('telegram_posted_at', null)
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
const items = selectDiverse(pool || [], MAX_PER_RUN, MAX_PER_TYPE, lastPosted);

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
  const message = buildMessage(item);
  if (DRY_RUN) {
    console.log('---');
    console.log(message);
    posted += 1;
    continue;
  }

  try {
    await sendTelegramMessage(message, buildKeyboard(item.id, item.slug, item.deadline));
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({ telegram_posted_at: new Date().toISOString() })
      .eq('id', item.id);
    if (updateError) {
      console.error(`Posted "${item.slug}" but failed to mark: ${updateError.message}`);
      failed += 1;
    } else {
      posted += 1;
      console.log(`✓ ${item.slug}`);
    }
  } catch (err) {
    console.error(`✗ ${item.slug}: ${err.message}`);
    failed += 1;
  }

  await new Promise((resolve) => setTimeout(resolve, 1500));
}

console.log(`Done: ${posted} posted, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
