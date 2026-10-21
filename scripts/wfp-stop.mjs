// Зупинити регулярні списання Dityam+ (21.10.2026).
//
// Навіщо. Dityam+ став безкоштовним, але підписки, створені до того,
// WayForPay списує далі. Зупинити їх можна лише Regular API, а він хоче
// merchantPassword — окремий пароль із кабінету (Налаштування магазину →
// магазин → «Реквізити мерчанту»), не секретний ключ.
//
// Номери замовлень беремо з бази, а не руками: wfp_order_reference — це
// номер ПЕРШОГО платежу, саме за ним WayForPay і скасовує регулярне.
//
// MODE=status (типово) лише читає стан і нічого не чіпає.
// MODE=remove — скасовує. Друкуємо лише коди відповідей, жодного секрету.
import crypto from 'crypto';

const MERCHANT = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
const REGULAR = process.env.WAYFORPAY_REGULAR_PASSWORD;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MODE = (process.env.MODE || 'status').toLowerCase();

if (!MERCHANT) { console.error('Немає WAYFORPAY_MERCHANT_ACCOUNT'); process.exit(1); }
if (!REGULAR) { console.error('Немає WAYFORPAY_REGULAR_PASSWORD — пароль із кабінету WayForPay'); process.exit(1); }
if (!SUPABASE_URL || !SERVICE_ROLE) { console.error('Немає доступу до Supabase'); process.exit(1); }

// Приймаємо і готовий 32-значний MD5, і звичайний пароль — хешуємо самі.
const isMd5 = (v) => /^[0-9a-f]{32}$/i.test(String(v || ''));
const merchantPassword = isMd5(REGULAR)
  ? REGULAR
  : crypto.createHash('md5').update(REGULAR, 'utf8').digest('hex');
console.log(`Пароль: ${isMd5(REGULAR) ? 'уже MD5' : 'звичайний, хешуємо самі'}.`);

const rows = await fetch(
  `${SUPABASE_URL}/rest/v1/digest_subscribers`
  + '?select=telegram_handle,telegram_chat_id,status,wfp_order_reference'
  + '&wfp_order_reference=not.is.null&order=created_at.desc',
  { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
).then((r) => r.json());

if (!Array.isArray(rows) || !rows.length) { console.log('Підписок із номером замовлення немає.'); process.exit(0); }
console.log(`Знайдено ${rows.length} підписок. Режим: ${MODE}.\n`);

async function ask(requestType, orderReference) {
  const r = await fetch('https://api.wayforpay.com/regularApi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType, merchantAccount: MERCHANT, merchantPassword, orderReference }),
  });
  return r.json().catch(() => ({}));
}

let failed = 0;
for (const row of rows) {
  const who = row.telegram_handle || row.telegram_chat_id || '—';
  const st = await ask('STATUS', row.wfp_order_reference);
  console.log(`${who} (${row.status})`);
  console.log(`  STATUS: ${st.reasonCode} ${st.reason || ''}`
    + (st.status ? ` | ${st.status} | ${st.mode || ''} | ${st.amount || ''} грн` : ''));

  if (MODE === 'remove') {
    // 4100 = Ok. Решту лишаємо видимою: мовчазна невдача тут означала б, що
    // людину списують далі, а ми думаємо, що скасували.
    const rm = await ask('REMOVE', row.wfp_order_reference);
    const ok = rm.reasonCode === 4100;
    if (!ok) failed += 1;
    console.log(`  REMOVE: ${ok ? '✅' : '❌'} ${rm.reasonCode} ${rm.reason || ''}`);
  }
}

if (failed) { console.error(`\n❌ Не скасовано: ${failed}.`); process.exit(1); }
console.log(`\n${MODE === 'remove' ? '✅ Усі регулярні списання скасовано.' : 'Перевірка завершена, нічого не змінено.'}`);
