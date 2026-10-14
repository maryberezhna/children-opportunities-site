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
const ROLE_NAMES = { parent: '👩 мама / тато', guardian: '🧑‍⚖️ опікун', teacher: '👩‍🏫 вчитель', teen: '🧑 підліток' };
const PERIOD = { monthly: 'місяць', halfyear: 'пів року', yearly: 'рік', gift: 'подарунок' };

// Звідки людина прийшла — людською мовою (Марія, 11.10.2026, ескіз «Користувачі»:
// «основні джерела, звідки прийшли»). Ключі — digest_subscribers.source і
// utm_source заявки на олімпіаду; невідоме лишаємо як є.
export const SOURCE_LABELS = {
  plus_uk: 'сторінка Dityam+', plus_en: 'сторінка Dityam+ (англ.)',
  olimpiada: 'олімпіада', from_olimpiada: 'олімпіада',
  channel_deadlines: 'Telegram-канал', telegram: 'Telegram-канал', channel: 'Telegram-канал',
  deadlines_calendar: 'календар дедлайнів', dedlainy: 'календар дедлайнів',
  instagram: 'Instagram', ig: 'Instagram', instagram_dm: 'Instagram', instagram_ads: 'реклама в Instagram',
  email: 'наш лист', dityam_plus: 'Dityam+',
};
export const sourceLabel = (s) => (s ? SOURCE_LABELS[s] || s : 'невідомо');

// Сторінка сайту, з якої людина прийшла (Марія, 12.10.2026: «чому тут нема
// посилань на сторінки»). Шлях «/…» — як є; відомі ключі — на свою сторінку;
// Telegram, Instagram, листи сторінки на сайті не мають — без посилання.
const SOURCE_PAGES = {
  plus_uk: '/plus', plus_en: '/en/plus', dityam_plus: '/plus',
  olimpiada: '/olimpiada', from_olimpiada: '/olimpiada',
  deadlines_calendar: '/dedlainy', dedlainy: '/dedlainy',
};
export const sourceHref = (s) => (!s ? null : s.startsWith('/') ? s : SOURCE_PAGES[s] || null);

const time = (iso) => (iso ? new Date(iso).getTime() : 0);
const lowerEmail = (e) => String(e || '').trim().toLowerCase() || null;
const at = (h) => `@${String(h).replace(/^@+/, '')}`;

export function buildPeople({ subs = [], plusWait = [], entries = [], olimpWait = [], mk = [], payments = [] } = {}) {
  const people = new Map();
  const person = (key, init) => {
    if (!people.has(key)) {
      people.set(key, {
        key, who: null, handle: null, email: null, me: false, notes: [], payments: [], first: null, last: null, results: [],
        sources: [], plus: null, olimp: null, ...init,
      });
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
    if (s.telegram_handle) { p.who = at(s.telegram_handle); p.handle = s.telegram_handle; }
    if (email) p.email = email;
    const period = s.status === 'active' && PERIOD[s.billing_period] ? ` · ${PERIOD[s.billing_period]}` : '';
    const stalled = s.status === 'pending' && s.billing_period !== 'gift'
      && time(s.updated_at || s.created_at) < Date.now() - 86400000;
    p.notes.push(stalled ? '💤 Dityam+ зупинились в оформленні' : `${PLUS_STATUS[s.status] || `Dityam+ ${s.status}`}${period}`);
    p.plus = { status: s.status, period: s.billing_period };
    // Хто заповнював анкету (13.10.2026): мама/тато, опікун, вчитель, підліток.
    if (ROLE_NAMES[s.role]) p.role = ROLE_NAMES[s.role];
    if (s.source) p.sources.push({ at: s.created_at, source: s.source });
    touch(p, s.created_at); touch(p, s.updated_at);
  }
  for (const w of plusWait) {
    const chat = w.telegram_chat_id ? String(w.telegram_chat_id) : null;
    const email = lowerEmail(w.email);
    const key = keyOf({ chat, email });
    if (!key) continue;
    const p = person(key);
    if (!p.who && w.telegram_username) { p.who = at(w.telegram_username); p.handle = w.telegram_username; }
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
    p.olimp = { print: Boolean(p.olimp?.print || e.print_paid_at) };
    // Сторінка результату з дипломом — та сама, що бачить родина.
    if (e.finished_at && e.token) p.results.push({ name: e.child_name || 'результат', href: `/olimpiada/test?t=${encodeURIComponent(e.token)}` });
    if (e.source && e.source !== 'check') p.sources.push({ at: e.created_at, source: e.source });
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
  // «Модний код» (14.10.2026): людина — email із заявки, як і в олімпіаді.
  // Оргвнесок іде повз таблицю payments (власний інвойс WayForPay у mk_entries),
  // тому оплату тримаємо в p.mk, а не в p.payments.
  for (const m of mk) {
    const email = lowerEmail(m.parent_email);
    if (!email) continue;
    const p = person(`em:${email}`, {});
    p.email = email;
    const name = m.child_name ? `${m.child_name}: ` : '';
    let what = 'заявка без оплати';
    if (m.refunded_at) what = 'оргвнесок повернено';
    else if (m.score != null) what = `пройшли тест · ${m.score}${m.max_score ? `/${m.max_score}` : ''}`;
    else if (m.paid_at) what = 'оплатили, тест попереду';
    p.notes.push(`👗 Модний код · ${name}${what}`);
    const paidNow = Boolean(m.paid_at) && !m.refunded_at;
    p.mk = {
      paid: Boolean(p.mk?.paid || paidNow),
      refunded: Boolean(p.mk?.refunded || m.refunded_at),
      sum: (p.mk?.sum || 0) + (paidNow ? Number(m.amount) || 0 : 0),
    };
    if (m.source) p.sources.push({ at: m.created_at, source: m.source });
    touch(p, m.created_at); touch(p, m.paid_at);
  }
  for (const pay of payments) {
    const key = keyOf({ chat: pay.telegram_chat_id ? String(pay.telegram_chat_id) : null, email: lowerEmail(pay.email) });
    if (!key) continue;
    const p = person(key);
    if (!p.who && pay.telegram_handle) { p.who = at(pay.telegram_handle); p.handle = pay.telegram_handle; }
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
    // «Чим скористався» і «Чи купила» — як на ескізі Марії (11.10.2026):
    // Олімпіада → безкоштовно / замовив доставку; Dityam+ → пробний місяць / 99 грн/міс.
    const used = [];
    if (p.olimp) {
      const prints = p.payments.filter((x) => x.product === 'olimp_print');
      const entryPaid = p.payments.filter((x) => x.product === 'olimp_entry');
      const sum = (list) => list.reduce((a, x) => a + (Number(x.amount) || 0), 0);
      let paid = 'безкоштовно';
      if (prints.length || p.olimp.print) paid = `замовив доставку${prints.length ? ` · ${sum(prints)} грн` : ''}`;
      else if (entryPaid.length) paid = `участь · ${sum(entryPaid)} грн`;
      used.push({ what: 'Олімпіада', paid, bought: paid !== 'безкоштовно' });
    }
    if (p.mk) {
      const paid = p.mk.paid ? `оргвнесок · ${p.mk.sum} грн` : p.mk.refunded ? 'повернено' : 'не оплатив';
      used.push({ what: 'Модний код', paid, bought: p.mk.paid });
    }
    const plusPays = p.payments.filter((x) => String(x.product || '').startsWith('plus_'));
    if (p.plus || plusPays.length) {
      let paid;
      if (plusPays.length) {
        const kinds = [...new Set(plusPays.map((x) => (Number(x.amount) <= 1 ? 'пробний місяць · 1 грн'
          : x.product === 'plus_halfyear' ? `пів року · ${Number(x.amount)} грн`
            : x.product === 'plus_yearly' ? `рік · ${Number(x.amount)} грн` : `${Number(x.amount)} грн/міс`)))];
        paid = `${kinds.join(', ')}${plusPays.length > 1 ? ` · оплат: ${plusPays.length}` : ''}`;
      } else if (p.plus?.period === 'gift') paid = 'подарунок';
      else if (p.plus?.status === 'pending') paid = 'не оплатив';
      else paid = 'без оплати';
      used.push({ what: 'Dityam+', paid, bought: plusPays.length > 0 });
    }
    const firstSource = [...p.sources].sort((a, b) => time(a.at) - time(b.at))[0]?.source || null;
    return {
      used,
      key: p.key,
      source: firstSource,
      who: p.who || (p.email ? `📧 ${p.email}` : `Telegram · …${p.key.slice(-4)}`),
      handle: p.handle ? String(p.handle).replace(/^@+/, '') : null,
      role: p.role || null,
      results: p.results,
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
    // Ескіз «Користувачі» (11.10.2026): нові за 24 години, куплено окремо
    // Dityam+ і доставка диплома, основні джерела.
    new24: rows.filter((r) => !r.me && time(r.first) >= now - 24 * 60 * 60 * 1000).length,
    boughtPlus: payments.filter((x) => String(x.product || '').startsWith('plus_')).reduce((s, x) => s + (Number(x.amount) || 0), 0),
    boughtPrint: payments.filter((x) => x.product === 'olimp_print').reduce((s, x) => s + (Number(x.amount) || 0), 0),
    topSources: (() => {
      const m = new Map();
      for (const r of rows) if (!r.me) { const k = sourceLabel(r.source); m.set(k, (m.get(k) || 0) + 1); }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    })(),
  };
}
