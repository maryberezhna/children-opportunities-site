// Нагадування про непереглянуту чергу модерації. Запускається кроном раз на
// три дні: якщо в черзі є кандидати, яких не чіпали ≥3 днів — Мария про них
// забула, шлемо нагадування з кнопкою «Переглянути».
//
// «Не чіпали» міряємо по updated_at: кнопки «Додати/Пропустити/Відкласти»
// оновлюють його, тож свіжовідкладені й щойно додані кандидати тривогу не
// здіймають — тільки ті, що справді висять.
import { createClient } from '@supabase/supabase-js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!TOKEN || !CHAT || !SB_URL || !SB_KEY) {
  console.error('Missing env: TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID / SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });

const threeDaysAgo = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();

const { count: total } = await supabase
  .from('opportunities')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'draft');

const { count: stale, error } = await supabase
  .from('opportunities')
  .select('id', { count: 'exact', head: true })
  .eq('status', 'draft')
  .lt('updated_at', threeDaysAgo);

if (error) {
  console.error('Supabase error:', error.message);
  process.exit(1);
}

if (!stale) {
  console.log(`Черга свіжа (усього draft: ${total || 0}, старших за 3 дні: 0) — нагадування не потрібне.`);
  process.exit(0);
}

const days = (n) => {
  const last = n % 100;
  if (last >= 11 && last <= 14) return 'днів';
  if (n % 10 === 1) return 'день';
  if (n % 10 >= 2 && n % 10 <= 4) return 'дні';
  return 'днів';
};

// Найстаріший — щоб у нагадуванні була конкретика, а не абстрактне «є черга».
const { data: oldest } = await supabase
  .from('opportunities')
  .select('title, updated_at')
  .eq('status', 'draft')
  .order('updated_at', { ascending: true })
  .limit(1);

const oldestDays = oldest?.length
  ? Math.floor((Date.now() - new Date(oldest[0].updated_at)) / 86400000)
  : 3;

const text = [
  '🔔 <b>Черга модерації чекає</b>',
  '',
  `У черзі <b>${total}</b> кандидатів, ${stale} з них висять понад 3 дні.`,
  oldest?.length
    ? `Найстаріший — «${String(oldest[0].title).slice(0, 80)}» — чекає ${oldestDays} ${days(oldestDays)}.`
    : '',
  '',
  'Кілька хвилин — і нові можливості підуть на сайт і в канал.',
].filter(Boolean).join('\n');

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chat_id: CHAT,
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [[{ text: '▶️ Переглянути', callback_data: 'mod:next' }]] },
  }),
});
const json = await res.json();
console.log(json.ok ? `Нагадування надіслано ✅ (черга: ${total}, застарілих: ${stale})` : `Failed: ${JSON.stringify(json)}`);
process.exit(json.ok ? 0 : 1);
