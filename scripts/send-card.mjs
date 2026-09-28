/**
 * Свіжа картка для Instagram однієї можливості — в адмінчат.
 *
 * Навіщо. Картку генерує сайт (/api/ig-card) з того, що зараз у базі, але
 * фото, яке контент-агент уже надіслав у чат, Telegram зберіг у себе й саме
 * не оновиться. Виправила назву — запусти цей воркфлоу, і в чат прийде нова
 * картка з тією самою підказкою, кого тегнути.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, SLUG, NOTE (необовʼязково).
 */
import { createClient } from '@supabase/supabase-js';
import { instagramHandles, tagLine, escapeHtml } from './ig-handles.mjs';

const SITE = 'https://dityam.com.ua';
const slug = String(process.env.SLUG || '').trim().replace(/^.*\/o\//, '').replace(/[/?#].*$/, '');
const note = String(process.env.NOTE || '').trim();
if (!slug) {
  console.error('SLUG порожній');
  process.exit(1);
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: item, error } = await sb
  .from('opportunities')
  .select('slug, title, source_url')
  .eq('slug', slug)
  .maybeSingle();
if (error) throw error;
if (!item) {
  console.error(`Запису «${slug}» немає`);
  process.exit(1);
}

const tags = tagLine(await instagramHandles(item.source_url));
// Підпис у HTML: логіни в <code> копіюються дотиком (див. tagLine).
const caption = [escapeHtml(item.title), `${SITE}/o/${item.slug}`, '', tags, escapeHtml(note.slice(0, 400))]
  .filter((s, i) => s || i === 2).join('\n');

// Параметр v — щоб Telegram завантажив картку заново, а не взяв збережену
// за тією самою адресою.
const photo = `${SITE}/api/ig-card?slug=${encodeURIComponent(item.slug)}&v=${Date.now()}`;
const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID, photo, caption, parse_mode: 'HTML' }),
});
const j = await r.json();
if (!j.ok) {
  console.error('telegram sendPhoto:', j.description);
  process.exit(1);
}
console.log(`Надіслано в адмінчат: ${item.title}\n${tags.replace(/<\/?code>/g, '')}`);
