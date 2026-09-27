// Лист тим, хто зупинився за крок до оплати Dityam+.
//
// Привід (27.09.2026). Крок «номер телефону» був глухим кутом: бот приймав
// номер лише кнопкою `request_contact`, на набраний руками текст не відповідав
// нічим, а `one_time_keyboard` ховав саму кнопку після першого ж слова. На
// ньому стали дві людини з повністю заповненими анкетами — @ttanyaost з
// 24.09 і @Olka666 з 26.09. Крок виправлено (PR #496): номер тепер
// необовʼязковий і приймається текстом.
//
// Кого беремо — НЕ за списком хендлів, а за станом: статус не активний, згода
// є, анкета є, телефону немає, і ще не писали. Тому скрипт безпечно
// перезапускати й тоді, коли хтось із них уже дійшов до оплати сам, — його
// просто не буде у вибірці.
//
// Пишемо ОДИН раз: після відправки ставимо stuck_notice_at. Другий лист про
// те саме — це вже не турбота.
//
// Запуск лише руками: .github/workflows/notify-stuck.yml (workflow_dispatch),
// за замовчуванням dry_run=true. Токен @DityamPlusBot живе в секретах GitHub і
// локально не потрібен.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PLUS_TOKEN = process.env.TELEGRAM_PLUS_BOT_TOKEN;
const DRY_RUN = process.env.DRY_RUN !== 'false';

for (const [name, value] of [['NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SERVICE_ROLE]]) {
  if (!value) { console.error(`Missing ${name}`); process.exit(1); }
}
if (!PLUS_TOKEN && !DRY_RUN) { console.error('Missing TELEGRAM_PLUS_BOT_TOKEN'); process.exit(1); }

// Текст Марії, від першої особи: лист особистий, а не системний.
//
// Чого тут свідомо немає: обіцянок на майбутнє («підберу», «надішлю») і
// виправдань про гроші. Є те, що вже зроблено, і одна дія — /start.
export const MESSAGE = [
  'Вітаю! Це Марія з Dityam.com.ua.',
  '',
  'Ви заповнили анкету для Dityam+ і зупинились на кроці з номером телефону. '
  + 'Це не ваша помилка: бот приймав номер лише кнопкою, а на набраний руками '
  + 'не відповідав нічого. Вибачте.',
  '',
  'Сьогодні виправила. Номер більше не обовʼязковий — поруч зʼявилась кнопка '
  + '«Пропустити, введу при оплаті».',
  '',
  'Анкета ваша збереглась, заповнювати заново не треба. Щоб продовжити з того '
  + 'самого місця — просто напишіть /start.',
  '',
  'А якщо передумали — теж напишіть, будь ласка, кількома словами чому. '
  + 'Мені це справді важливо.',
].join('\n');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Анкета в окремій таблиці: «дійшла до кінця» означає, що дитина там є.
const { data: rows, error } = await supabase.from('digest_subscribers')
  .select('id, telegram_handle, telegram_chat_id, status, flow_step, phone, consent_at, stuck_notice_at')
  .neq('status', 'active')
  .is('phone', null)
  .is('stuck_notice_at', null)
  .not('consent_at', 'is', null)
  .not('telegram_chat_id', 'is', null);
if (error) { console.error('Supabase:', error.message); process.exit(1); }

const ids = (rows || []).map((r) => r.id);
const { data: kids } = ids.length
  ? await supabase.from('plus_children').select('subscriber_id').in('subscriber_id', ids)
  : { data: [] };
const withProfile = new Set((kids || []).map((k) => k.subscriber_id));
const targets = (rows || []).filter((r) => withProfile.has(r.id));

if (!targets.length) { console.log('Нікого писати: вибірка порожня.'); process.exit(0); }

console.log(`Кому (${targets.length}):`);
for (const t of targets) {
  console.log(`  ${t.telegram_handle || '—'} · chat ${t.telegram_chat_id} · ${t.status}/${t.flow_step || '—'}`);
}
if (DRY_RUN) {
  console.log('\n--- DRY RUN, нічого не надіслано ---\n');
  console.log(MESSAGE);
  process.exit(0);
}

let sent = 0;
for (const t of targets) {
  const res = await fetch(`https://api.telegram.org/bot${PLUS_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: t.telegram_chat_id, text: MESSAGE, disable_web_page_preview: true,
    }),
  }).catch((e) => ({ ok: false, _err: e.message }));
  // Тіло читаємо ЗАВЖДИ, а не лише при res.ok: саме у відповіді з кодом 400
  // чи 403 Telegram і пише, що не так («chat not found», «bot was blocked»,
  // «Unauthorized»). Перший прогін 27.09.2026 упав на обох, і в логах було
  // тільки «no ok» — тобто рівно нічого.
  const body = typeof res.json === 'function'
    ? await res.json().catch(() => ({}))
    : {};
  if (body.ok) {
    // Позначку ставимо ТІЛЬКИ після того, як Telegram прийняв: інакше людина
    // лишилась би і без листа, і поза наступною вибіркою.
    await supabase.from('digest_subscribers')
      .update({ stuck_notice_at: new Date().toISOString() }).eq('id', t.id);
    sent += 1;
    console.log(`✅ ${t.telegram_handle || t.telegram_chat_id}`);
  } else {
    // Найчастіша причина — людина заблокувала бота. Це не помилка запуску:
    // решту листів треба дописати.
    console.log(`⚠️ ${t.telegram_handle || t.telegram_chat_id}: `
      + `${res.status || '—'} ${body.description || res._err || 'без пояснення'}`);
  }
}
console.log(`Надіслано: ${sent} з ${targets.length}`);
