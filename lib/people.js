// Сторінка /admin/lyudy — усі люди Dityam.com.ua одним списком (Марія,
// 08.10.2026: «мені по факту треба своя сторінка в адмінці, щоб бачити, хто і
// скільки разів щось купував і підписувався на нас»).
//
// Людина = Telegram (Dityam+) або email (олімпіада, списки очікування). Ці
// два світи між собою не повʼязані: пошти в боті ми не питаємо, а Telegram у
// заявці на олімпіаду — теж. Тому одна й та сама мама може стояти двома
// рядками — склеювати їх навмання не можна. Чиста функція — її перевіряє тест.
import { PRODUCT_LABELS } from './payments.js';
import { levelByKey } from './olimpiada.js';

// Адреси Марії: у списку людей це вона (memory: dityam-maria-own-emails).
const OWN_EMAILS = new Set(['mashaberezhna0209@gmail.com', 'maryberezhna@gmail.com']);

const PLUS_STATUS = {
  active: '✅ Dityam+ активна',
  pending: '⏳ Dityam+ оформлює',
  paused: '⚠️ Dityam+ пауза',
  unsubscribed: 'Dityam+ відписався',
  cancelled: 'Dityam+ скасовано',
};
const PERIOD = { monthly: 'місяць', halfyear: 'пів року', yearly: 'рік', gift: 'подарунок' };

const time = (iso) => (iso ? new Date(iso).getTime() : 0);
const lowerEmail = (e) => String(e || '').trim().toLowerCase() || null;
const at = (h) => `@${String(h).replace(/^@+/, '')}`;

export function buildPeople({ subs = [], plusWait = [], entries = [], olimpWait = [], payments = [] } = {}) {
  const people = new Map();
  const person = (key, init) => {
    if (!people.has(key)) {
      people.set(key, { key, who: null, email: null, me: false, notes: [], payments: [], first: null, last: null, ...init });
    }
    return people.get(key);
  };
  const touch = (p, iso) => {
    const t = time(iso);
    if (!t) return;
    if (!p.first || t < time(p.first)) p.first = iso;
    if (!p.last || t > time(p.last)) p.last = iso;
  };
  const keyOf = ({ chat, email }) => (chat ? `tg:${chat}` : email ? `em:${email}` : null);

  for (const s of subs) {
    const chat = s.telegram_chat_id ? String(s.telegram_chat_id) : null;
    const email = lowerEmail(s.email);
    const key = keyOf({ chat, email });
    if (!key) continue;
    const p = person(key);
    if (s.telegram_handle) p.who = at(s.telegram_handle);
    if (email) p.email = email;
    const period = s.status === 'active' && PERIOD[s.billing_period] ? ` · ${PERIOD[s.billing_period]}` : '';
    p.notes.push(`${PLUS_STATUS[s.status] || `Dityam+ ${s.status}`}${period}`);
    touch(p, s.created_at); touch(p, s.updated_at);
  }
  for (const w of plusWait) {
    const chat = w.telegram_chat_id ? String(w.telegram_chat_id) : null;
    const email = lowerEmail(w.email);
    const key = keyOf({ chat, email });
    if (!key) continue;
    const p = person(key);
    if (!p.who && w.telegram_username) p.who = at(w.telegram_username);
    if (email) p.email = email;
    p.notes.push('📋 список очікування Dityam+');
    touch(p, w.created_at);
  }
  for (const e of entries) {
    // Тестові записи адміна — не люди.
    if (e.wfp_last_status === 'Test') continue;
    const email = lowerEmail(e.parent_email);
    if (!email) continue;
    const p = person(`em:${email}`, {});
    p.email = email;
    const name = e.child_name ? `${e.child_name}: ` : '';
    let what = 'зареєструвались';
    if (e.finished_at) what = `пройшли тест${e.level ? ` · ${levelByKey(e.level).label.toLowerCase()}` : ''}`;
    else if (e.started_at) what = 'почали тест';
    else if (!e.paid_at) what = 'не завершили заявку';
    p.notes.push(`🧩 Олімпіада · ${name}${what}`);
    touch(p, e.created_at); touch(p, e.finished_at);
  }
  for (const w of olimpWait) {
    const email = lowerEmail(w.email);
    if (!email) continue;
    const p = person(`em:${email}`, {});
    p.email = email;
    p.notes.push('📋 список очікування олімпіади');
    touch(p, w.created_at);
  }
  for (const pay of payments) {
    const key = keyOf({ chat: pay.telegram_chat_id ? String(pay.telegram_chat_id) : null, email: lowerEmail(pay.email) });
    if (!key) continue;
    const p = person(key);
    if (!p.who && pay.telegram_handle) p.who = at(pay.telegram_handle);
    if (!p.email && pay.email) p.email = lowerEmail(pay.email);
    p.payments.push(pay);
    touch(p, pay.paid_at);
  }

  return [...people.values()].map((p) => {
    const byProduct = new Map();
    for (const pay of p.payments) {
      const r = byProduct.get(pay.product) || { product: pay.product, label: PRODUCT_LABELS[pay.product] || pay.product, count: 0, sum: 0 };
      r.count += 1;
      r.sum += Number(pay.amount) || 0;
      byProduct.set(pay.product, r);
    }
    return {
      key: p.key,
      who: p.who || (p.email ? `📧 ${p.email}` : `Telegram · …${p.key.slice(-4)}`),
      email: p.email,
      me: Boolean(p.email && OWN_EMAILS.has(p.email)),
      notes: [...new Set(p.notes)],
      bought: [...byProduct.values()],
      count: p.payments.length,
      total: p.payments.reduce((s, x) => s + (Number(x.amount) || 0), 0),
      first: p.first,
      last: p.last,
    };
  }).sort((a, b) => time(b.last) - time(a.last));
}

/** Підсумки над таблицею. */
export function peopleSummary(rows, payments = [], now = Date.now()) {
  const month = now - 30 * 24 * 60 * 60 * 1000;
  return {
    people: rows.filter((r) => !r.me).length,
    buyers: rows.filter((r) => !r.me && r.count > 0).length,
    repeat: rows.filter((r) => !r.me && r.count > 1).length,
    total: payments.reduce((s, x) => s + (Number(x.amount) || 0), 0),
    total30: payments.filter((x) => time(x.paid_at) >= month).reduce((s, x) => s + (Number(x.amount) || 0), 0),
  };
}
