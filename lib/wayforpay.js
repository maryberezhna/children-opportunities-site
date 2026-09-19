// WayForPay — регулярні платежі для підписки Dityam+.
// Env: WAYFORPAY_MERCHANT_ACCOUNT, WAYFORPAY_SECRET_KEY, WAYFORPAY_DOMAIN,
//      WAYFORPAY_AMOUNT (грн/міс), WAYFORPAY_AMOUNT_YEAR (грн/рік), SITE_URL.
// Значення нижче — лише запасні. Бойова ціна задається змінними оточення
// у Vercel: якщо WAYFORPAY_AMOUNT там виставлений, він переважає.
import crypto from 'crypto';

const MERCHANT = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
const SECRET = process.env.WAYFORPAY_SECRET_KEY;
const DOMAIN = process.env.WAYFORPAY_DOMAIN || 'dityam.com.ua';
const AMOUNT = Number(process.env.WAYFORPAY_AMOUNT || 99);
const AMOUNT_YEAR = Number(process.env.WAYFORPAY_AMOUNT_YEAR || 999);
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const CURRENCY = 'UAH';

export const wayforpayConfigured = Boolean(MERCHANT && SECRET);
export const PRICE = AMOUNT;
export const PRICE_YEAR = AMOUNT_YEAR;

const sign = (parts) => crypto.createHmac('md5', SECRET).update(parts.join(';'), 'utf8').digest('hex');

// Тіло CREATE_INVOICE: перший платіж + регулярне списання. Винесено окремо,
// щоб суми перевіряв тест (tests/wayforpay.test.mjs) без мережі.
// orderReference кодує токен підписника, щоб звʼязати колбек із рядком у БД.
//
// firstAmount — ціна ПЕРШОГО платежу за промокодом (lib/promo.js). Діє і на
// місячний, і на річний план: код `first` дає перший місяць за 1 грн, а перший
// рік — за 499 замість 999. До 19.09.2026 тут була ще окрема знижка для списку
// очікування (`early`); тепер механіка одна — промокод.
//
// Критично: regularAmount завжди лишається ПОВНОЮ ціною. За документацією
// WayForPay це «Amount of regular payment. If not transferred, the amount is
// taken from the 'amount' field», а dateNext — дата першого регулярного
// списання (https://wiki.wayforpay.com/en/view/852102). Без явного
// regularAmount людину списували б по 1 грн щомісяця назавжди.
export function invoiceBody(sub, plan = 'monthly', { firstAmount = null, now = new Date() } = {}) {
  const yearly = plan === 'yearly';
  const regularAmount = yearly ? AMOUNT_YEAR : AMOUNT;
  const promo = Number(firstAmount) > 0 && Number(firstAmount) < regularAmount ? Number(firstAmount) : null;
  const discounted = promo !== null;
  const amount = discounted ? promo : regularAmount;
  const product = yearly
    ? (discounted ? 'Підписка Dityam+ (перший рік зі знижкою)' : 'Підписка Dityam+ (рік)')
    : discounted ? 'Підписка Dityam+ (перший місяць зі знижкою)' : 'Підписка Dityam+ (місяць)';
  const regularMode = yearly ? 'yearly' : 'monthly';
  // Безстрокова підписка: наступне списання через період, кінець — далеко в майбутньому.
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const dNext = new Date(now);
  if (yearly) dNext.setFullYear(dNext.getFullYear() + 1); else dNext.setMonth(dNext.getMonth() + 1);
  const dEnd = new Date(now); dEnd.setFullYear(dEnd.getFullYear() + 10);
  const orderReference = `${sub.unsub_token}-${now.getTime()}`;
  const orderDate = Math.floor(now.getTime() / 1000);
  const signature = sign([
    MERCHANT, DOMAIN, orderReference, String(orderDate), String(amount), CURRENCY,
    product, '1', String(amount),
  ]);
  return {
    transactionType: 'CREATE_INVOICE',
    merchantAccount: MERCHANT,
    merchantAuthType: 'SimpleSignature',
    merchantDomainName: DOMAIN,
    merchantSignature: signature,
    apiVersion: 1,
    language: 'UA',
    serviceUrl: `${SITE_URL}/api/pay/wayforpay`,
    returnUrl: `${SITE_URL}/dyakuyu?paid=1`,
    orderReference,
    orderDate,
    amount,
    currency: CURRENCY,
    clientEmail: sub.email || undefined,   // підставляється на сторінці оплати
    clientPhone: sub.phone || undefined,
    productName: [product],
    productPrice: [amount],
    productCount: [1],
    regularMode,
    regularOn: 1,
    regularAmount,
    dateNext: fmtDate(dNext),
    dateEnd: fmtDate(dEnd),
  };
}

export async function createInvoice(sub, plan = 'monthly', opts = {}) {
  if (!wayforpayConfigured) return { error: 'not_configured' };
  const body = invoiceBody(sub, plan, opts);
  try {
    const r = await fetch('https://api.wayforpay.com/api', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    // #bot → сторінка оплати одразу відкривається на BotPay (лише номер телефону, без email).
    if (j.invoiceUrl) return { url: `${j.invoiceUrl}#bot`, orderReference: body.orderReference };
    return { error: j.reason || 'no_invoice', raw: j };
  } catch (e) {
    return { error: String(e) };
  }
}

// Скасування рекурентного списання.
//
// Критично: відписка в боті чи за посиланням змінює лише статус у нашій БД —
// WayForPay про це не знає й списує далі (інвойс створюється з regularOn:1 і
// dateEnd на 10 років уперед). Без цього виклику людина перестає отримувати
// підбірку, але платить далі.
//
// Regular API автентифікується merchantPassword (це секретний ключ), а не
// підписом: https://wiki.wayforpay.com/en/view/852521
export async function removeRecurring(orderReference) {
  if (!wayforpayConfigured) return { ok: false, error: 'not_configured' };
  if (!orderReference) return { ok: false, error: 'no_order_reference' };
  try {
    const r = await fetch('https://api.wayforpay.com/regularApi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'REMOVE',
        merchantAccount: MERCHANT,
        merchantPassword: SECRET,
        orderReference,
      }),
    });
    const j = await r.json().catch(() => ({}));
    // 4100 = Ok. Усе інше лишаємо в reason, щоб було видно в логах Vercel.
    return { ok: j.reasonCode === 4100, reasonCode: j.reasonCode, reason: j.reason };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Перевірка підпису службового колбека від WayForPay.
export function verifyCallback(b) {
  if (!SECRET) return false;
  const expected = sign([
    b.merchantAccount, b.orderReference, String(b.amount), b.currency,
    b.authCode, b.cardPan, b.transactionStatus, String(b.reasonCode),
  ]);
  return expected === b.merchantSignature;
}

// Обовʼязкова відповідь WayForPay, що ми прийняли колбек.
export function acceptResponse(orderReference) {
  const time = Math.floor(Date.now() / 1000);
  return {
    orderReference,
    status: 'accept',
    time,
    signature: sign([orderReference, 'accept', String(time)]),
  };
}

// Витягти токен підписника з orderReference (`<token>-<ts>`).
export const tokenFromOrderRef = (ref) => String(ref || '').split('-')[0];
