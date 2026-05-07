import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const MAX_PER_RUN = Number(process.env.MAX_PER_RUN || 8);
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

const COST_LABELS = {
  free: 'Безкоштовно',
  partially_free: 'З фінансуванням',
  paid_affordable: 'Доступно',
  paid_premium: 'Преміум',
  closed: 'Закрита подача',
};

function ageLabel(item) {
  if (item.age_from === 0 && item.age_to >= 17) return '0–18 років';
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
  if (cost) meta.push(item.cost_type === 'free' ? `✅ ${cost}` : `💸 ${cost}`);
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

async function sendTelegramMessage(text) {
  const apiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    }),
  });
  const json = await res.json();
  if (!json.ok) {
    throw new Error(`Telegram API error: ${json.error_code} ${json.description}`);
  }
  return json.result;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: items, error } = await supabase
  .from('opportunities')
  .select('id, slug, title, summary, opportunity_type, age_from, age_to, cost_type, format, deadline')
  .is('telegram_posted_at', null)
  .order('created_at', { ascending: true })
  .limit(MAX_PER_RUN);

if (error) {
  console.error('Supabase select error:', error);
  process.exit(1);
}

if (!items || items.length === 0) {
  console.log('No new opportunities to post.');
  process.exit(0);
}

console.log(`Posting ${items.length} new opportunit${items.length === 1 ? 'y' : 'ies'} to Telegram${DRY_RUN ? ' (DRY RUN)' : ''}...`);

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
    await sendTelegramMessage(message);
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
