/**
 * Контент-агент: щотижневі чернетки постів для Instagram.
 *
 * Навіщо. Телеграм у нас закритий повністю — щоденний дайджест, персональні
 * добірки, нагадування. Instagram не покритий нічим, і саме там треба рости.
 * Писати щотижня руками — задача, яку в один момент перестають робити.
 *
 * Що агент НЕ робить: не публікує. Правило «вичитувати кожен текст перед
 * відправкою» тут головніше за зручність — пост від імені платформи, якій
 * вірять, не може виходити без людини. Агент готує все до кнопки: текст,
 * картинку, хештеги — лишається прочитати й викласти.
 *
 * Медіа з галереї. Бібліотеку Photos macOS не віддає стороннім процесам, тож
 * агент дивиться в теку, куди ти складаєш дібрані фото й кліпи (--media).
 * У GitHub Actions її немає — там працює лише генерована картка.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
 *      TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID.
 * Прапорці: --media <тека>, --count N (деф. 5), --dry (не слати в телеграм).
 */
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { isoWeek } from '../lib/week.js';
import { TYPE_LABELS } from '../lib/labels.js';

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const HAS = (name) => process.argv.includes(name);

const SITE = 'https://dityam.com.ua';
const COUNT = Number(arg('--count', 5));
const MEDIA_DIR = arg('--media');
const DRY = HAS('--dry');

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const day = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000) : null;
};

/**
 * Голос платформи. Це не «стиль», а перелік того, чим Dityam уже заплатив за
 * помилки: слово «каталог» знецінює те, що робиться; виправдання про гроші
 * читаються як «нам ніяково»; вигадана цифра коштує довіри дорожче, ніж
 * коштує сам пост.
 */
const VOICE = `Ти пишеш для Instagram платформи dityam.com.ua — вона збирає перевірені
можливості для українських дітей 0–18: гуртки, конкурси, табори, стипендії,
допомогу. Пишеш як редактор, не як бот.

Правила, які не обговорюються:
1. Ніколи не називай Dityam «каталогом». Це платформа.
2. Не виправдовуйся про гроші: жодних «ми не платний сервіс», «нічого не
   продаємо», «нам нічого не треба». Платформа безкоштовна — це факт, а не
   виправдання, і згадувати його треба лише коли це доречно.
3. Не вигадуй фактів. Дата, вік, вартість, місто — тільки ті, що дані.
   Якщо чогось немає — не пиши про це взагалі.
4. Без канцеляриту й без реклами. «Здійснюється набір учасників» — це не
   українська мова. Пиши так, як розповіла б подрузі.
5. Без каскаду емодзі та без 30 хештегів.

Як побудований хороший пост:
— Перший рядок — про ситуацію батька або дитини, а не назва програми. Саме
  його видно в стрічці, і саме він вирішує, чи читатимуть далі.
— Далі конкретика: що це, кому за віком, скільки коштує, до якої дати.
— Наприкінці — де шукати: «посилання в шапці профілю» або «dityam.com.ua».
— 4–7 хештегів, українською, по суті.
— Довжина 500–900 символів.`;

async function candidates() {
  const week = isoWeek();
  const today = day(new Date().toISOString());
  const { data, error } = await sb
    .from('opportunities')
    .select('slug, title, summary, details, opportunity_type, age_from, age_to, cost_type, price_note, cities, deadline, featured_week, source_url, created_at')
    .eq('status', 'active')
    .is('canonical_slug', null);
  if (error) throw error;

  const withDays = (data || []).map((o) => ({ ...o, days: o.deadline ? day(o.deadline) - today : null }));
  const seen = new Set();
  const take = (list) => list.filter((o) => !seen.has(o.slug) && seen.add(o.slug));

  // Спершу трійка тижня — вона вже відібрана правилом і стоїть на сайті
  // нагорі. Далі те, що ось-ось закриється: саме про це варто нагадати.
  // Наприкінці — свіже, щоб стрічка не була самими дедлайнами.
  const top = take(withDays.filter((o) => o.featured_week === week));
  const soon = take(withDays
    .filter((o) => o.days !== null && o.days >= 3 && o.days <= 21)
    .sort((a, b) => a.days - b.days));
  const fresh = take(withDays
    .filter((o) => (o.summary || '').length >= 120)
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')));

  return [...top, ...soon, ...fresh].slice(0, COUNT);
}

/** Фото й кліпи з теки, яку ти наповнюєш сама. Бібліотеку Photos macOS не віддає. */
async function media(dir) {
  if (!dir) return { photos: [], clips: [] };
  try {
    const names = await readdir(dir);
    const photos = names.filter((n) => ['.jpg', '.jpeg', '.png', '.heic'].includes(extname(n).toLowerCase()));
    const clips = names.filter((n) => ['.mov', '.mp4', '.m4v'].includes(extname(n).toLowerCase()));
    return { photos, clips, dir };
  } catch {
    console.warn(`Теку «${dir}» не прочитав — працюю без твоїх медіа.`);
    return { photos: [], clips: [] };
  }
}

async function write(items, clips) {
  const facts = items.map((o, i) => {
    const parts = [`#${i + 1} ${o.title}`, `тип: ${TYPE_LABELS[o.opportunity_type] || o.opportunity_type}`,
      `вік: ${o.age_from}–${o.age_to}`];
    if (o.cost_type === 'free') parts.push('безкоштовно');
    else if (o.cost_type === 'partially_free') parts.push('з фінансуванням');
    else if (o.cost_type) parts.push(o.price_note ? `платно: ${o.price_note}` : 'платно');
    const city = (o.cities || []).find((c) => c);
    if (city) parts.push(`місце: ${city}`);
    if (o.deadline) parts.push(`дедлайн: ${o.deadline} (через ${o.days} дн.)`);
    parts.push(`опис: ${(o.summary || '').slice(0, 400)}`);
    parts.push(`сторінка: ${SITE}/o/${o.slug}`);
    return parts.join('\n');
  }).join('\n\n---\n\n');

  const reels = clips.length
    ? `\n\nУ мене є ${clips.length} відеокліпів: ${clips.slice(0, 12).join(', ')}. Для НАЙСИЛЬНІШОЇ з можливостей додай короткий сценарій Reels: 3–4 сцени, що показувати й який текст на екрані. Назви файл кліпу, який пасує за змістом.`
    : '';

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      system: VOICE,
      messages: [{
        role: 'user',
        content: `Напиши ${items.length} постів в Instagram — по одному на кожну можливість нижче.

Формат відповіді — рівно такий, без нічого зайвого:

===ПОСТ 1===
<текст поста з хештегами>

===ПОСТ 2===
...

Можливості:

${facts}${reels}`,
      }],
    }),
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(json?.error?.message || `Anthropic ${resp.status}`);
  return (json.content || []).map((b) => b.text || '').join('');
}

const tg = async (method, body) => {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID, ...body }),
  });
  const j = await r.json();
  if (!j.ok) console.error(`telegram ${method}:`, j.description);
  return j;
};

async function main() {
  const week = isoWeek();
  const items = await candidates();
  if (!items.length) {
    console.log('Кандидатів немає.');
    return;
  }
  const { photos, clips, dir } = await media(MEDIA_DIR);
  console.log(`Тиждень ${week}. Можливостей: ${items.length}. `
    + (dir ? `Твоїх медіа: ${photos.length} фото, ${clips.length} відео.` : 'Медіа-теки немає — картки генеровані.'));

  const text = await write(items, clips);
  const posts = text.split(/===ПОСТ\s*\d+===/).map((s) => s.trim()).filter(Boolean);
  console.log(`\nНаписано постів: ${posts.length}\n`);

  if (DRY) {
    posts.forEach((p, i) => console.log(`\n===== ПОСТ ${i + 1} =====\n${p}\n`));
    return;
  }

  await tg('sendMessage', {
    text: `✍️ <b>Контент на тиждень ${week}</b>\n\n${posts.length} чернеток нижче — картинка й текст до кожної. Вичитай і виклади.`
      + (dir ? `\n\nТвоїх медіа в теці: ${photos.length} фото, ${clips.length} відео.` : ''),
    parse_mode: 'HTML',
  });

  for (let i = 0; i < posts.length; i += 1) {
    const item = items[i];
    if (item) {
      await tg('sendPhoto', {
        photo: `${SITE}/api/ig-card?slug=${item.slug}`,
        caption: `${i + 1}/${posts.length} · ${item.title.slice(0, 120)}`,
      });
    }
    // Текст окремим повідомленням: із підпису під фото його не скопіювати
    // цілком, а копіювати доведеться щоразу.
    await tg('sendMessage', { text: posts[i].slice(0, 4000), disable_web_page_preview: true });
  }
  console.log('Надіслано в адмінчат.');
}

main().catch((e) => { console.error(e); process.exit(1); });
