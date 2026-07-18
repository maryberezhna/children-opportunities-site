// WayForPay — регулярні платежі для підписки Dityam+.
// Env: WAYFORPAY_MERCHANT_ACCOUNT, WAYFORPAY_SECRET_KEY, WAYFORPAY_DOMAIN,
//      WAYFORPAY_AMOUNT (грн/міс, default 99), SITE_URL.
import crypto from 'crypto';

const MERCHANT = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
const SECRET = process.env.WAYFORPAY_SECRET_KEY;
const DOMAIN = process.env.WAYFORPAY_DOMAIN || 'dityam.com.ua';
const AMOUNT = Number(process.env.WAYFORPAY_AMOUNT || 79);
const AMOUNT_YEAR = Number(process.env.WAYFORPAY_AMOUNT_YEAR || 799);
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const CURRENCY = 'UAH';

export const wayforpayConfigured = Boolean(MERCHANT && SECRET);
export const PRICE = AMOUNT;
export const PRICE_YEAR = AMOUNT_YEAR;

const sign = (parts) => crypto.createHmac('md5', SECRET).update(parts.join(';'), 'utf8').digest('hex');

// Створює інвойс на перший платіж + регулярне щомісячне списання.
// orderReference кодує токен підписника, щоб звʼязати колбек із рядком у БД.
export async function createInvoice(sub, plan = 'monthly') {
  if (!wayforpayConfigured) return { error: 'not_configured' };
  const yearly = plan === 'yearly';
  const amount = yearly ? AMOUNT_YEAR : AMOUNT;
  const product = yearly ? 'Підписка Dityam+ (рік)' : 'Підписка Dityam+ (місяць)';
  const regularMode = yearly ? 'yearly' : 'monthly';
  const orderReference = `${sub.unsub_token}-${Date.now()}`;
  const orderDate = Math.floor(Date.now() / 1000);
  const signature = sign([
    MERCHANT, DOMAIN, orderReference, String(orderDate), String(amount), CURRENCY,
    product, '1', String(amount),
  ]);
  const body = {
    transactionType: 'CREATE_INVOICE',
    merchantAccount: MERCHANT,
    merchantAuthType: 'SimpleSignature',
    merchantDomainName: DOMAIN,
    merchantSignature: signature,
    apiVersion: 1,
    language: 'UA',
    serviceUrl: `${SITE_URL}/api/pay/wayforpay`,
    returnUrl: `${SITE_URL}/pidbirka?paid=1`,
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
    regularAmount: amount,
  };
  try {
    const r = await fetch('https://api.wayforpay.com/api', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.invoiceUrl) return { url: j.invoiceUrl, orderReference };
    return { error: j.reason || 'no_invoice', raw: j };
  } catch (e) {
    return { error: String(e) };
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
