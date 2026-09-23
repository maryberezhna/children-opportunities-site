// Тижневий звіт в адмін-чат: що людина виправляє за моделлю.
//
// Привід (23.09.2026). Марія спитала, чи вчиться модель на наших правках. Ні —
// і гірше: ми не зберігали навіть того, ЩО саме людина виправила. Модератор
// міняв тип із «Курс» на «Табір», і старе значення зникало назавжди. Конвеєр
// повторював ті самі помилки, а правила в промпт доводилось вписувати руками,
// бо порахувати їх не було з чого.
//
// Цей звіт — не навчання моделі, а його фундамент: показати закономірність,
// яку потім людина свідомо віднесе в промпт. Тому й мова звіту така: не
// «зроблено N правок», а «яке поле модель систематично не вгадує».
//
// Принцип morning-brief: якщо за тиждень виправлень немає — нічого не
// надсилаємо. Тиша теж інформація.
import { createClient } from '@supabase/supabase-js';
import { TYPE_LABELS, COST_LABELS } from '../lib/labels.js';
import { plural } from '../lib/plural.js';
import { DECISION_FIELD, FIELD_LABELS, groupCorrections } from '../lib/corrections.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const SITE = process.env.SITE_URL || 'https://dityam.com.ua';
const PERIOD_DAYS = Number(process.env.PERIOD_DAYS || 7);
const DRY = process.env.DRY_RUN === 'true';

if (!SB_URL || !SB_KEY || (!DRY && (!TOKEN || !CHAT))) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cut = (s, n = 48) => (String(s).length > n ? `${String(s).slice(0, n - 1).trimEnd()}…` : String(s));

const FORMAT_LABELS = { online: 'Онлайн', offline: 'Офлайн', hybrid: 'Онлайн і офлайн' };
const RECURRENCE_LABELS = { annual: 'Щороку', ongoing: 'Постійно доступна' };
// Статуси — ліворуч від стрілки, дії — праворуч: «Чернетка → пропустити».
const DECISION_LABELS = {
  draft: 'Чернетка', active: 'На сайті', closed: 'Приховано', archived: 'В архіві',
  skip: 'пропустити', remove: 'прибрати з сайту',
};

/** Машинне значення → те, як його бачить людина в адмінці. */
function valueText(field, value) {
  if (value === null || value === undefined) return '— порожньо —';
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') {
    const action = DECISION_LABELS[value.action] || value.action;
    return value.comment ? `${action} («${cut(value.comment, 60)}»)` : action;
  }
  const map = {
    opportunity_type: TYPE_LABELS,
    cost_type: COST_LABELS,
    format: FORMAT_LABELS,
    recurrence: RECURRENCE_LABELS,
    [DECISION_FIELD]: DECISION_LABELS,
  }[field];
  if (map && map[value]) return map[value];
  return cut(String(value), 44);
}

const since = new Date(Date.now() - PERIOD_DAYS * 86400000).toISOString();

const { data, error } = await supabase
  .from('moderation_corrections')
  .select('field, before, after, source, created_at, opportunity_id, opportunities(title, slug)')
  .gte('created_at', since)
  .order('created_at', { ascending: false })
  .limit(2000);

if (error) {
  // Міграцію 20260923_moderation_corrections.sql застосовують руками. Поки її
  // немає — звіт мовчить і виходить зеленим, а не фарбує воркфлоу в червоне
  // щотижня.
  if (/does not exist|schema cache|relation/i.test(error.message || '')) {
    console.log('Таблиці moderation_corrections ще немає — застосуй supabase/migrations/20260923_moderation_corrections.sql');
    process.exit(0);
  }
  console.error(`Supabase: ${error.message}`);
  process.exit(1);
}

const rows = data || [];
if (!rows.length) {
  console.log(`За ${PERIOD_DAYS} днів виправлень немає — нічого не надсилаємо.`);
  process.exit(0);
}

const groups = groupCorrections(rows);
const touched = new Set(rows.map((r) => r.opportunity_id).filter(Boolean)).size;

const blocks = groups.map((g) => {
  const lines = [`🔧 <b>${esc(FIELD_LABELS[g.field] || g.field)}</b> — ${g.count}`];

  if (g.pairs.length) {
    lines.push(`Повторюється: ${g.pairs
      .map((p) => `${esc(valueText(g.field, p.before))} → ${esc(valueText(g.field, p.after))} ×${p.count}`)
      .join(' · ')}`);
  }

  for (const ex of g.examples) {
    const title = esc(cut(ex.title || 'без назви'));
    const name = ex.slug ? `<a href="${SITE}/o/${esc(ex.slug)}">${title}</a>` : title;
    lines.push(`• ${name}\n  ${esc(valueText(g.field, ex.before))} → ${esc(valueText(g.field, ex.after))}`);
  }
  return lines.join('\n');
});

// Telegram ріже повідомлення на 4096 символах і віддає помилку, а не обрізок.
// Поля вже відсортовані від найчастішого, тож лишаємо початок: хвіст — це
// одиничні правки, які закономірності однаково не дають.
const head = `📝 <b>Що людина виправляє за моделлю</b> (${PERIOD_DAYS} дн.)`;
const stats = `Виправлень: ${rows.length} у ${touched} записах.`;
// Хвіст пояснює, що з цим робити: сам по собі перелік — ще не дія.
const tail = 'Пара, що повторюється, — це правило, якого бракує моделі. '
  + 'Переносити в промпт свідомо й по одному: модель на цих правках сама не вчиться.';

const fit = [];
let used = head.length + stats.length + tail.length + 200;
for (const block of blocks) {
  if (used + block.length > 3900) break;
  used += block.length + 2;
  fit.push(block);
}
const hidden = blocks.length - fit.length;

const text = [
  head,
  stats,
  ...fit,
  ...(hidden ? [`…і ще ${hidden} ${plural(hidden, 'поле', 'поля', 'полів')} з поодинокими правками.`] : []),
  tail,
].join('\n\n');

if (DRY) {
  console.log(text);
  process.exit(0);
}

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: CHAT,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  }),
});
const json = await res.json();
console.log(json.ok ? `Звіт надіслано ✅ (${groups.length} полів, ${rows.length} виправлень)` : `Failed: ${JSON.stringify(json)}`);
process.exit(json.ok ? 0 : 1);
