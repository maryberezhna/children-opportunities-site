// Разова діагностика Regular API WayForPay (20.10.2026).
//
// Скасування підписки падало з «Validation error. merchantPassword: Provided
// argument must be a string with length 32». Ми слали сирий секретний ключ;
// припустили, що треба MD5 — але перевірити це можна лише з живим ключем,
// а він є тільки в секретах GitHub.
//
// Тут requestType STATUS: лише читає стан регулярного платежу, нічого не
// змінює й не скасовує. Пробує два варіанти пароля й друкує, що відповів
// WayForPay. Жодного секрету в лог не потрапляє — лише довжина.
import crypto from 'crypto';

const MERCHANT = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
const SECRET = process.env.WAYFORPAY_SECRET_KEY;
const ORDER = process.env.ORDER_REFERENCE;

if (!MERCHANT || !SECRET) { console.error('Немає MERCHANT або SECRET'); process.exit(1); }
if (!ORDER) { console.error('Немає ORDER_REFERENCE'); process.exit(1); }

const md5 = crypto.createHash('md5').update(SECRET, 'utf8').digest('hex');
console.log(`Ключ: довжина ${SECRET.length}. MD5: довжина ${md5.length}.`);

async function probe(label, merchantPassword) {
  const r = await fetch('https://api.wayforpay.com/regularApi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'STATUS', merchantAccount: MERCHANT, merchantPassword, orderReference: ORDER }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(`\n[${label}] HTTP ${r.status}`);
  console.log('  reasonCode:', j.reasonCode, '| reason:', j.reason);
  if (j.status) console.log('  status:', j.status, '| mode:', j.mode, '| amount:', j.amount);
}

await probe('MD5 ключа', md5);
await probe('сирий ключ', SECRET);
