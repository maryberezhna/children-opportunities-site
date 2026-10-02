// WayForPay — регулярні платежі для підписки Dityam+.
// Env: WAYFORPAY_MERCHANT_ACCOUNT, WAYFORPAY_SECRET_KEY, WAYFORPAY_DOMAIN,
//      WAYFORPAY_AMOUNT (грн/міс), WAYFORPAY_AMOUNT_HALF (грн за пів року), SITE_URL.
// Значення нижче — лише запасні. Бойова ціна задається змінними оточення
// у Vercel: якщо WAYFORPAY_AMOUNT там виставлений, він переважає.
import crypto from 'crypto';

const MERCHANT = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
const SECRET = process.env.WAYFORPAY_SECRET_KEY;
const DOMAIN = process.env.WAYFORPAY_DOMAIN || 'dityam.com.ua';
const AMOUNT = Number(process.env.WAYFORPAY_AMOUNT || 119);
// Пів року замість року (рішення Марії 24.09.2026: «у мене не буде річної
// підписки, зроби піврічну»; ціна 549 — 27.09.2026). Річну більше не продаємо;
// старі номери замовлень із позначкою `y` periodFromOrderRef ще впізнає.
const AMOUNT_HALF = Number(process.env.WAYFORPAY_AMOUNT_HALF || 549);
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const CURRENCY = 'UAH';

export const wayforpayConfigured = Boolean(MERCHANT && SECRET);
export const PRICE = AMOUNT;
export const PRICE_HALF = AMOUNT_HALF;

const sign = (parts) => crypto.createHmac('md5', SECRET).update(parts.join(';'), 'utf8').digest('hex');

// Тіло CREATE_INVOICE: перший платіж + регулярне списання. Винесено окремо,
// щоб суми перевіряв тест (tests/wayforpay.test.mjs) без мережі.
// orderReference кодує токен підписника, щоб звʼязати колбек із рядком у БД.
//
// firstAmount — ціна ПЕРШОГО платежу за промокодом (lib/promo.js). Діє і на
// місячний, і на піврічний план: код `first` дає перший місяць за 1 грн, а
// перші пів року — за 439 замість 549. До 19.09.2026 тут була ще окрема знижка для списку
// очікування (`early`); тепер механіка одна — промокод.
//
// Критично: regularAmount завжди лишається ПОВНОЮ ціною. За документацією
// WayForPay це «Amount of regular payment. If not transferred, the amount is
// taken from the 'amount' field», а dateNext — дата першого регулярного
// списання (https://wiki.wayforpay.com/en/view/852102). Без явного
// regularAmount людину списували б по 1 грн щомісяця назавжди.
export function invoiceBody(sub, plan = 'monthly', { firstAmount = null, now = new Date() } = {}) {
  // Режим WayForPay `halfyearly` — «раз на півроку»
  // (https://wiki.wayforpay.com/view/852102, поле regularMode).
  const half = plan === 'halfyear';
  const regularAmount = half ? AMOUNT_HALF : AMOUNT;
  const promo = Number(firstAmount) > 0 && Number(firstAmount) < regularAmount ? Number(firstAmount) : null;
  const discounted = promo !== null;
  const amount = discounted ? promo : regularAmount;
  // Назва описує ПІДПИСКУ, а не перший платіж. WayForPay зберігає productName
  // один раз і чіпляє його й до регулярного списання: 24.09.2026 у листі
  // «Створено регулярний платіж» вийшло «Сума: 119 UAH» поруч із «Підписка
  // Dityam+ (перший місяць зі знижкою)» — знижка була разова, на 1 грн.
  // Знижку видно там, де їй місце: у сумі першого рахунку.
  const product = half ? 'Підписка Dityam+ (пів року)' : 'Підписка Dityam+ (місяць)';
  const regularMode = half ? 'halfyearly' : 'monthly';
  // Безстрокова підписка: наступне списання через період, кінець — далеко в майбутньому.
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  const dNext = new Date(now);
  dNext.setMonth(dNext.getMonth() + (half ? 6 : 1));
  const dEnd = new Date(now); dEnd.setFullYear(dEnd.getFullYear() + 10);
  // Період — у самому номері замовлення: з промокодом перший довгий платіж
  // (439) менший за звичайну ціну, і колбек за сумою записував би його
  // «місячним» (адмінка й MRR брехали б). Токен лишається першою частиною.
  const orderReference = `${sub.unsub_token}-${now.getTime()}-${half ? 'h' : 'm'}`;
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

/** Пів року чи місяць: з позначки в номері замовлення; для старих номерів — за сумою.
 *  `y` — річні замовлення до 27.09.2026: їх уже не продаємо, але впізнаємо. */
export function periodFromOrderRef(ref, amount) {
  const tail = String(ref || '').split('-')[2];
  if (tail === 'h') return 'halfyear';
  if (tail === 'y') return 'yearly';
  if (tail === 'm') return 'monthly';
  return Number(amount) >= AMOUNT_HALF ? 'halfyear' : 'monthly';
}

// ────────────────────────────────────────────────────────────────────────────
// Чому платіж не пройшов.
//
// Колбек приносить transactionStatus + reasonCode + reason, але до 24.09.2026
// ми з них читали лише статус: у базі лишалось голе «paused», і єдиним місцем
// із причиною був кабінет WayForPay. Тепер причину зберігаємо й показуємо.

/** Статуси невдачі, які надсилає WayForPay (решта — Approved або проміжні). */
export const FAILED_STATUSES = {
  Declined: 'банк відхилив оплату',
  Expired: 'рахунок протермінувався, оплати не було',
  Refunded: 'гроші повернули',
  Voided: 'платіж скасовано',
  RefundInProcessing: 'повернення в обробці',
};

// Коди дослівно з https://wiki.wayforpay.com/en/view/852131 — перекладені,
// не вигадані. 4xxx сюди не входять: це відповіді regularApi, не колбека.
export const WFP_REASONS = {
  1100: 'успішно',
  1101: 'банк, що видав картку, відхилив платіж',
  1102: 'неправильний CVV2',
  1103: 'термін дії картки вийшов',
  1104: 'недостатньо коштів на картці',
  1105: 'недійсна картка',
  1106: 'перевищено дозволену частоту списань',
  1108: '3-D Secure не пройдено',
  1109: 'помилка формату запиту',
  1110: 'недопустима валюта',
  1112: 'номер замовлення вже використано',
  1113: 'невірний підпис запиту',
  1114: 'запідозрено шахрайство',
  1115: 'бракує параметра в запиті',
  1116: 'токен не знайдено',
  1117: 'API недоступне мерчанту',
  1118: 'обмеження на боці мерчанта',
  1120: 'автентифікація недоступна',
  1121: 'акаунт не знайдено',
  1122: 'платіжний шлюз відхилив',
  1123: 'повернення не дозволене',
  1124: 'сесія на сторінці оплати збігла — оплату не завершили',
  1125: 'людина скасувала оплату',
  1126: 'недопустимий стан замовлення',
  1127: 'замовлення не знайдено',
  1128: 'перевищено ліміт повернень',
  1129: 'помилка скрипта на боці WayForPay',
  1130: 'недопустима сума',
  1131: 'транзакція в обробці',
  1132: 'транзакцію відкладено',
  1133: 'недопустима комісія',
  1134: 'транзакція очікує',
  1135: 'не пройдено ліміти картки',
  1136: 'замалий баланс мерчанта',
  1137: 'невірна сума підтвердження',
  1138: 'повернення в обробці',
  1139: 'зовнішня відмова під час зарахування',
  1140: 'перевищено частоту зарахувань',
  1141: 'часткове скасування не підтримується',
  1142: 'у зарахуванні відмовлено',
  1143: 'невірний номер телефону',
  1144: 'транзакція очікує доставки',
  1145: 'транзакція очікує рішення про кредит',
  1146: 'картка з обмеженнями',
  1147: 'клієнта не знайдено',
  1148: 'клієнта не привʼязано',
  1149: 'клієнта заблоковано',
  1151: 'рахунок чекає на оплату',
  5100: 'очікуються дані 3-D Secure',
};

/**
 * Один рядок про невдалу оплату: що сталося і чому.
 *
 * Код завжди точніший за статус, тому веде він. 24.09.2026 WayForPay прислав
 * Declined з кодом 1124 (Cardholder session expired, Payment type NO PAYMENT):
 * назвати це «банк відхилив оплату» було б брехнею — картку не вводили взагалі.
 * Незнайомий код не ковтаємо: показуємо статус і текст WayForPay як є.
 */
export function describeFailure({ status, reasonCode, reason } = {}) {
  const code = Number(reasonCode) || null;
  const known = code ? WFP_REASONS[code] : null;
  if (known) return `${known} (${code})`;
  const head = FAILED_STATUSES[status] || status || 'оплата не пройшла';
  const why = reason ? String(reason).trim() : '';
  if (!why) return head;
  return `${head} — ${why}${code ? ` (${code})` : ''}`;
}

/**
 * Що сказати САМІЙ людині, коли оплата не пройшла.
 *
 * describeFailure вище — для адміна: там код і наша термінологія. Людині код
 * нічого не каже, а «обмеження на боці мерчанта» звучить як її провина.
 *
 * Навіщо (02.10.2026). Доти при невдалій оплаті сповіщення йшло ЛИШЕ в
 * адмінчат. Людина проходила всю анкету, тиснула «Оплатити», банк відмовляв —
 * і далі тиша. 24.09.2026 так сталося з першою людиною, що дійшла до оплати
 * Dityam+: вона не дізналась ні що не вийшло, ні що робити.
 *
 * Три різні поради, бо три різні причини:
 *   • картка — вирішує людина (інша картка, кошти, строк дії);
 *   • не довершили — рахунок просто збіг, досить почати знову;
 *   • наш бік — людина не винна й нічого «виправити» не може, тому
 *     єдина обіцянка, яку тут можна дати: ми бачимо й розберемось.
 *
 * Правила Марії: без дефіциту («ви єдина, хто дійшов до оплати»), без
 * виправдань про гроші, без коду в тексті.
 */
const CARD_CODES = new Set([1101, 1102, 1103, 1104, 1105, 1106, 1108, 1114, 1120, 1121, 1122]);
const OUR_SIDE_CODES = new Set([1109, 1110, 1112, 1113, 1115, 1116, 1117, 1118, 1126, 1127, 1129, 1130]);
const UNFINISHED_CODES = new Set([1124, 1125]);

// Повернення й скасування — не «оплата не пройшла». Сказати людині, що оплата
// не вийшла, коли ми ЇЙ ПОВЕРНУЛИ гроші, — це збрехати в найгіршу мить.
// Такі статуси людині не пишемо зовсім: повернення обговорюють окремо.
const NOT_A_FAILED_ATTEMPT = new Set(['Refunded', 'Voided', 'RefundInProcessing']);

export function failureAdviceForPerson({ status, reasonCode } = {}) {
  if (NOT_A_FAILED_ATTEMPT.has(status)) return null;
  const code = Number(reasonCode) || null;
  if (UNFINISHED_CODES.has(code) || status === 'Expired') {
    return {
      kind: 'unfinished',
      // Не «оплата не пройшла»: нічого не ламалось, рахунок просто застарів.
      title: 'Оплату не завершено',
      text: 'Рахунок діє годину, і цей час уже минув. Нічого страшного — ось нове '
        + 'посилання, усі ваші відповіді на місці.',
    };
  }
  if (OUR_SIDE_CODES.has(code)) {
    return {
      kind: 'ours',
      title: 'Оплата не пройшла',
      text: 'Причина на нашому боці — з карткою все гаразд. Ми вже бачимо це й '
        + 'розбираємось. Спробувати ще раз можна за посиланням нижче.',
    };
  }
  if (CARD_CODES.has(code) || status === 'Declined') {
    return {
      kind: 'card',
      title: 'Оплата не пройшла',
      text: 'Банк не пропустив платіж. Таке буває через ліміт на інтернет-платежі, '
        + 'строк дії картки або брак коштів у цю хвилину. Варто спробувати ще раз '
        + 'або іншою карткою — усі ваші відповіді на місці.',
    };
  }
  return {
    kind: 'unknown',
    title: 'Оплата не пройшла',
    text: 'Чому саме — банк не повідомив. Спробуйте ще раз за посиланням нижче: '
      + 'усі ваші відповіді на місці.',
  };
}

/**
 * Адреса нашого переходу на оплату.
 *
 * 24.09.2026: рахунок WayForPay живий рівно годину (у кабінеті це поле
 * «Valid to»), а кнопка в Telegram лишається в чаті назавжди. Тому в кнопку
 * більше не зашивається invoiceUrl — вона веде сюди, і рахунок народжується
 * у мить натискання. Заразом зникають два зайві CREATE_INVOICE на кожен
 * /start: раніше їх робили наосліп, ще до того, як людина щось натисне.
 */
export const payStartUrl = (token, plan = 'monthly') =>
  `${SITE_URL}/api/pay/start?t=${encodeURIComponent(token)}&plan=${plan === 'halfyear' ? 'halfyear' : 'monthly'}`;

/**
 * Чи цей номер замовлення створили ми: `<token>-<ms>` і, з 23.09.2026,
 * `<token>-<ms>-<m|y|h>` (`h` — пів року, з 27.09.2026). Номери, які WayForPay робить сам для регулярного
 * списання, цього вигляду не мають — на цьому й тримається перевірка нижче.
 */
export const isOurOrderRef = (ref) => /^[0-9a-f]{32}-\d{10,}(-[myh])?$/i.test(String(ref || ''));

/**
 * Чи має невдалий платіж зупиняти підписку.
 *
 * 24.09.2026: перша підписниця заплатила об 11:56, а о 12:12 прийшов
 * Declined 1124 від ІНШОГО, покинутого рахунку — і код зняв її з active у
 * paused + free. Тобто одна зайва вкладка з оплатою вбивала оплачену
 * підписку, бо колбек шукав людину за unsub_token і не дивився, про який
 * саме рахунок ідеться.
 *
 * Правило: активну підписку зупиняє лише невдача на ЇЇ рахунку. Чужий
 * (але наш за форматом) номер — це покинута спроба, її ігноруємо. Номер не
 * нашого вигляду — це списання, яке WayForPay зробив сам, і його невдача
 * означає, що картка більше не платить: таку підписку зупиняємо.
 */
export function failureStopsSubscription({ status, storedRef, failedRef } = {}) {
  if (status !== 'active') return true;
  if (!storedRef) return true;
  if (String(failedRef || '').startsWith(storedRef)) return true;
  return !isOurOrderRef(failedRef);
}
