/**
 * Нагадування в адмін-чат: час обрати «Обкладинку місяця» «Модного коду»
 * (Марія, 13.10.2026: «щомісяця визначаємо переможця… ні, просто
 * нагадування» — замість кнопки в адмінці). 1-го числа — список кандидатів
 * за попередній місяць; 5-го — ще раз, лише якщо переможця досі немає
 * (оголошуємо до 7-го). Критерій Марії — «бали + образ»: серед найвищих балів
 * журі обирає найкращий образ, тож показуємо топ за балами з назвою образу й
 * картинкою обкладинки. Переможця ставлять у базі: mk_entries.winner_month.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID.
 * DRY_RUN=1 — лише надрукувати.
 */
import { createClient } from '@supabase/supabase-js';
import { isOwn } from '../lib/own.js';

const SITE = 'https://dityam.com.ua';
const TOP = 10;
const MONTHS_NOM = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function kyivMonthKey(date) {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit' }).formatToParts(new Date(date));
  return `${p.find((x) => x.type === 'year').value}-${p.find((x) => x.type === 'month').value}`;
}
export function prevMonthKey(now = new Date()) {
  const [y, m] = kyivMonthKey(now).split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Кандидати: завершили обкладинку в цьому місяці, не повернення, не тести й не Марія. */
export function candidates(rows, key) {
  return (rows || [])
    .filter((r) => r.look_at && !r.refunded_at && r.source !== 'admin_test' && !isOwn(r))
    .filter((r) => kyivMonthKey(r.finished_at || r.look_at) === key)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || String(a.look_at).localeCompare(String(b.look_at)));
}

export function buildMessage(list, key, { again = false } = {}) {
  const m = Number(key.split('-')[1]);
  const [y] = key.split('-');
  const nextGen = MONTHS_GEN[m % 12];
  const lines = [
    `👗 <b>«Модний код»: ${again ? 'нагадування — ' : ''}час обрати «Обкладинку місяця» за ${MONTHS_NOM[m - 1]} ${y}</b>`,
    `Оголосити — до 7 ${nextGen}. Критерій: серед найвищих балів — найкращий образ.`,
    '',
    `Учасників за місяць: ${list.length}. Найвищі бали:`,
    ...list.slice(0, TOP).map((r, i) => `${i + 1}. ${esc(r.child_name)}, ${r.child_age} · <b>${r.score}/${r.max_score}</b> · «${esc(r.look_title || 'без назви')}» — <a href="${SITE}/api/modnyi-kod/cover?t=${r.token}">обкладинка</a>`),
    '',
    'Кого обрали — скажіть, і переможцю поставлять позначку «Обкладинка місяця».',
  ];
  return lines.join('\n');
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY не задані');
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const month = prevMonthKey();
  const again = new Date().getUTCDate() >= 5;

  const { count: chosen } = await sb.from('mk_entries').select('id', { count: 'exact', head: true }).eq('winner_month', month);
  if (chosen) { console.log(`Переможець за ${month} уже є — мовчимо.`); return; }

  const since = new Date(Date.now() - 45 * 864e5).toISOString();
  const { data, error } = await sb.from('mk_entries')
    .select('token, child_name, child_age, score, max_score, look_title, look_at, finished_at, refunded_at, source, parent_email, telegram_chat_id')
    .not('look_at', 'is', null).gte('look_at', since);
  if (error) throw new Error(error.message);
  const list = candidates(data, month);
  if (!list.length) { console.log(`За ${month} обкладинок немає — нагадування не шлемо.`); return; }

  const text = buildMessage(list, month, { again });
  if (process.env.DRY_RUN) { console.log(text); return; }
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_ADMIN_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw new Error(`Telegram: ${j.description || res.status}`);
  console.log(`Нагадування за ${month} надіслано: ${list.length} учасників.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
