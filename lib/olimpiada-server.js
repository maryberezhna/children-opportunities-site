// Серверна частина онлайн-олімпіади: сховище записів, оплата, сповіщення.
// Лише для API-маршрутів і серверних сторінок — тут сервісний ключ Supabase.
import crypto from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { makeBot } from './digestFlow.js';
import { OLIMP, isBundle, teacherCode, validTeacherCode } from './olimpiada.js';
import { checkStatus, createOneTimeInvoice } from './wayforpay.js';
import { sendInvite, sendTeacherWelcome, sendTeacherThanks } from './olimpiada-mail.js';
import { recordPayment } from './payments.js';

export const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAIN_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const TABLE = 'olimpiada_entries';
const TEACHERS = 'olimpiada_teachers';
const OLIMP_GIFT = false;

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const isProd = process.env.NODE_ENV === 'production';

// Локально сервісного ключа немає (у .env.local лише anon), тож без запасного
// сховища тест і диплом не можна було б навіть відкрити в `next dev`. У
// продакшні цієї гілки не існує: без ключа сховища просто немає.
function devStore() {
  const rows = (globalThis.__olimpDevRows ||= new Map());
  const find = (pred) => [...rows.values()].find(pred) || null;
  return {
    dev: true,
    async create(fields) {
      const row = {
        id: crypto.randomUUID(), token: crypto.randomBytes(16).toString('hex'),
        created_at: new Date().toISOString(), ...fields,
      };
      rows.set(row.token, row);
      return row;
    },
    async get(token) { return rows.get(token) || null; },
    async getByOrder(ref) { return find((r) => r.wfp_order_reference === ref); },
    async getByPrintRef(ref) { return find((r) => r.print_ref === ref); },
    async update(token, patch) {
      const row = rows.get(token);
      if (!row) return null;
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      return row;
    },
    async claim(token, field, patch) {
      const row = rows.get(token);
      if (!row || row[field]) return null;
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      return row;
    },
    async createGift() { return crypto.randomBytes(16).toString('hex'); },
    async recordPayment() { return null; },
    async recentByEmail(email, sinceIso) {
      return [...rows.values()].filter((r) => r.parent_email === email && r.created_at >= sinceIso);
    },
    async addWaitlist(fields) {
      const list = (globalThis.__olimpDevWait ||= new Map());
      const already = list.has(fields.email);
      if (!already) list.set(fields.email, fields);
      return { already, count: list.size };
    },
    // Педагоги (11.10.2026) — ті самі методи, що й у supabaseStore.
    async teacherByCode(code) { return devTeachers().get(code) || null; },
    async teacherByEmail(olimp, email) {
      return [...devTeachers().values()].find((t) => t.olimp === olimp && t.email === email) || null;
    },
    async createTeacher(fields) {
      const list = devTeachers();
      if ([...list.values()].some((t) => t.olimp === fields.olimp && t.email === fields.email)) return { conflict: 'email' };
      if (list.has(fields.code)) return { conflict: 'code' };
      const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), thanks_sent_at: null, ...fields };
      list.set(row.code, row);
      return { row };
    },
    async teacherFinished(code) {
      return [...rows.values()].filter((r) => r.teacher_code === code && r.finished_at).length;
    },
    async claimTeacherThanks(code) {
      const t = devTeachers().get(code);
      if (!t || t.thanks_sent_at) return null;
      t.thanks_sent_at = new Date().toISOString();
      return t;
    },
    async releaseTeacherThanks(code) {
      const t = devTeachers().get(code);
      if (t) t.thanks_sent_at = null;
    },
  };
}
const devTeachers = () => (globalThis.__olimpDevTeachers ||= new Map());

// Кожен запит до бази — повз Data Cache Next.js. Сторінка результату й маршрут
// диплома — GET, і Next кешував відповіді fetch бібліотеки Supabase навіть при
// force-dynamic: 05–06.10.2026 сторінка показувала Марії стан «до старту» вже
// після завершеного тесту, а диплом віддавав 404, хоча POST-маршрути бачили
// свіжий запис.
const freshFetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

function supabaseStore() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false }, global: { fetch: freshFetch } });
  const one = async (query) => {
    const { data, error } = await query;
    if (error) throw new Error(`olimpiada store: ${error.message}`);
    return data || null;
  };
  return {
    dev: false,
    create: (fields) => one(supabase.from(TABLE).insert(fields).select('*').single()),
    get: (token) => one(supabase.from(TABLE).select('*').eq('token', token).maybeSingle()),
    getByOrder: (ref) => one(supabase.from(TABLE).select('*').eq('wfp_order_reference', ref).maybeSingle()),
    getByPrintRef: (ref) => one(supabase.from(TABLE).select('*').eq('print_ref', ref).maybeSingle()),
    // Журнал оплат (lib/payments.js) — для /admin/lyudy.
    recordPayment: (row) => recordPayment(supabase, row),
    // Заявки на цю пошту за останню добу — для ліміту безкоштовної форми.
    recentByEmail: async (email, sinceIso) => (await one(supabase.from(TABLE)
      .select('token, child_name, started_at, finished_at, paid_at, created_at')
      .eq('parent_email', email).gte('created_at', sinceIso).order('created_at', { ascending: false }).limit(50))) || [],
    update: (token, patch) => one(supabase.from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('token', token).select('*').maybeSingle()),
    // Оновити, лише якщо поле ще порожнє, — і повернути запис, якщо вийшло.
    // Так одну подію не опрацюють двічі: колбек WayForPay і звірка на
    // сторінці (paid_at), сайт і запасний скрипт листів (invite_sent_at).
    claim: (token, field, patch) => one(supabase.from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('token', token).is(field, null)
      .select('*').maybeSingle()),
    // Місяць Dityam+ кожному учасникові. Рядок чекає в статусі pending, доки
    // людина не відкриє бота за посиланням: активним його робить бот у мить
    // привʼязки чату, інакше щоденна добірка шукала б чат, якого ще немає.
    async createGift(entry) {
      const until = new Date(Date.now() + OLIMP.giftDays * 24 * 60 * 60 * 1000).toISOString();
      const row = await one(supabase.from('digest_subscribers').insert({
        channel: 'telegram', email: entry.parent_email || null, status: 'pending', plan: 'premium',
        billing_period: 'gift', gift_until: until, consent_at: entry.consent_at || new Date().toISOString(),
        source: 'olimpiada',
      }).select('unsub_token').single());
      return row?.unsub_token || null;
    },
    // Список очікування: повторний email — не помилка, просто «вже є».
    async addWaitlist(fields) {
      const { error } = await supabase.from('olimpiada_waitlist').insert(fields);
      if (error && error.code !== '23505') throw new Error(`olimpiada waitlist: ${error.message}`);
      const { count } = await supabase.from('olimpiada_waitlist')
        .select('id', { count: 'exact', head: true }).eq('olimp', fields.olimp);
      return { already: Boolean(error), count: count ?? null };
    },
    // ── Педагоги (11.10.2026) ──
    teacherByCode: (code) => one(supabase.from(TEACHERS).select('*').eq('code', code).maybeSingle()),
    // Email зберігаємо вже малими літерами, тож eq збігається з індексом lower(email).
    teacherByEmail: (olimp, email) => one(supabase.from(TEACHERS).select('*').eq('olimp', olimp).eq('email', email).maybeSingle()),
    // Новий рядок або { conflict }: 'email' — цей педагог уже є (паралельна
    // форма), 'code' — випадковий код збігся з чужим, беремо інший.
    async createTeacher(fields) {
      const { data, error } = await supabase.from(TEACHERS).insert(fields).select('*').single();
      if (!error) return { row: data };
      if (error.code !== '23505') throw new Error(`olimpiada teachers: ${error.message}`);
      return { conflict: /email/.test(`${error.message} ${error.details || ''}`) ? 'email' : 'code' };
    },
    // Скільки учнів за посиланням педагога вже пройшли тест (count, не рядки).
    async teacherFinished(code) {
      const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true })
        .eq('teacher_code', code).not('finished_at', 'is', null);
      if (error) throw new Error(`olimpiada teachers: ${error.message}`);
      return count || 0;
    },
    claimTeacherThanks: (code) => one(supabase.from(TEACHERS)
      .update({ thanks_sent_at: new Date().toISOString() }).eq('code', code).is('thanks_sent_at', null)
      .select('*').maybeSingle()),
    releaseTeacherThanks: (code) => one(supabase.from(TEACHERS).update({ thanks_sent_at: null }).eq('code', code)),
  };
}

export function getStore() {
  if (SUPABASE_URL && SERVICE_ROLE) return supabaseStore();
  if (!isProd) return devStore();
  return null;
}

const TOKEN_RE = /^[0-9a-f]{32}$/;
export const validToken = (t) => TOKEN_RE.test(String(t || ''));

export async function notifyAdmin(text) {
  if (!MAIN_TOKEN || !ADMIN_CHAT_ID) return;
  try { await makeBot(MAIN_TOKEN).sendMessage(ADMIN_CHAT_ID, text); } catch { /* сповіщення не має ламати оплату */ }
}

// Участь підтверджена — оплатою (до 08.10.2026) або одразу, бо вона тепер
// безкоштовна (`free`): ставимо позначку paid_at («доступ відкрито»), заводимо
// подарунковий місяць Dityam+, надсилаємо запрошення й кажемо адмінці про
// справжні оплати. Оплату «бере» лише один виклик:
// повторний колбек WayForPay чи звірка на сторінці в ту саму мить нічого не
// дублюють — ні подарунка, ні листа, ні повідомлення.
export async function markPaid(store, entry, { test = false, free = false } = {}) {
  if (entry.paid_at) return entry;
  const now = new Date().toISOString();
  // Заявка «з дипломом» (249 грн, до 08.10.2026): доставку оплачено разом з участю,
  // адресу батьки вкажуть після тесту на сторінці результату.
  const bundle = isBundle(entry);
  const paid = await store.claim(entry.token, 'paid_at', {
    paid_at: now, wfp_last_status: test ? 'Test' : free ? 'Free' : 'Approved',
    ...(bundle && !entry.print_paid_at ? { print_paid_at: now } : {}),
  });
  if (!paid) return (await store.get(entry.token)) || entry;
  let updated = paid;
  // Подарунковий місяць Dityam+ більше не заводимо (Марія, 08.10.2026: «замість
  // подарунка» — перший місяць за 1 грн після тесту). Видані раніше подарунки
  // працюють як і були: бот активує їх за plus_token.
  if (OLIMP_GIFT && !paid.plus_token) {
    try {
      const plusToken = await store.createGift(paid);
      if (plusToken) updated = (await store.update(paid.token, { plus_token: plusToken })) || { ...paid, plus_token: plusToken };
    } catch (e) { console.error('[olimpiada] gift:', e); }
  }
  // Запрошення з посиланням на тест — одразу, а не за розкладом GitHub.
  await sendInvite(store, updated);
  // Платна участь (до 08.10.2026) — у журнал оплат; безкоштовна й тестова — ні.
  if (!test && !free && Number(paid.amount) > 0 && paid.wfp_order_reference) {
    await store.recordPayment?.({
      order_reference: paid.wfp_order_reference, tx_key: paid.wfp_order_reference,
      amount: Number(paid.amount), product: 'olimp_entry', paid_at: now,
      email: paid.parent_email || null, name: paid.child_name || null, olimp_token: paid.token,
    });
  }
  // Тестові записи адміна й безкоштовні заявки в чат не йдуть: там лише
  // справжні покупки (правило Марії 07.10.2026 — «лише найнеобхідніше»).
  if (!test && !free) await notifyAdmin(
    `🧩 <b>Олімпіада: ${test ? 'тестовий запис' : 'оплата'}</b>\n`
    + `${esc(entry.child_name)}${entry.child_age ? `, ${esc(entry.child_age)} р.` : ''}\n`
    + `${esc(entry.parent_email || '—')}${test ? '' : ` · ${Number(entry.amount) || 0} грн`}`
    + (bundle ? '\n📮 разом із друкованим дипломом — адресу вкажуть після тесту' : ''),
  );
  return updated;
}

// Ключі правильних відповідей. Репозиторій сайту публічний, тому відповіді
// в коді лежати не можуть: вони в таблиці olimpiada_keys (лише сервер).
// Локально, без сервісного ключа, — content/olimpiada/keys.local.json (у
// .gitignore). Кеш на 5 хвилин: ключі міняються рідко, а тестів багато.
const keyCache = (globalThis.__olimpKeys ||= new Map());
export async function loadKeys(slug = OLIMP.slug) {
  const hit = keyCache.get(slug);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.keys;
  let keys = null;
  if (SUPABASE_URL && SERVICE_ROLE) {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false }, global: { fetch: freshFetch } });
    const { data, error } = await supabase.from('olimpiada_keys').select('answers').eq('olimp', slug).maybeSingle();
    if (error) console.error('[olimpiada] keys:', error.message);
    keys = data?.answers || null;
  } else if (!isProd) {
    try {
      keys = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'olimpiada', 'keys.local.json'), 'utf8'))[slug] || null;
    } catch { keys = null; }
  }
  if (keys) keyCache.set(slug, { keys, at: Date.now() });
  return keys;
}

// ── Педагоги (11.10.2026) ───────────────────────────────────────────────────
// Реєстрація з форми на /olimpiada: той самий email — той самий код і без
// нового листа (created: false). Лист із посиланням — лише першого разу;
// mailed — чи він справді пішов: форма не обіцяє листа, якого не було.
export async function registerTeacher(store, { name, email, source = null }) {
  const olimp = OLIMP.slug;
  const existing = await store.teacherByEmail(olimp, email);
  if (existing) return { teacher: existing, created: false };
  for (let i = 0; i < 4; i += 1) {
    const res = await store.createTeacher({
      code: teacherCode(crypto.randomBytes(8)), olimp, name, email,
      consent_at: new Date().toISOString(), source,
    });
    if (res.row) {
      const mailed = await sendTeacherWelcome(store, res.row);
      return { teacher: res.row, created: true, mailed };
    }
    // Та сама форма, надіслана двічі в одну мить: рядок уже створив сусідній запит.
    if (res.conflict === 'email') {
      const row = await store.teacherByEmail(olimp, email);
      if (row) return { teacher: row, created: false };
    }
  }
  throw new Error('olimpiada teachers: no free code');
}

// Педагог за кодом із заявки. Будь-яка помилка (таблиці ще немає, база не
// відповіла) — просто «без педагога»: заявка дитини важливіша за позначку.
export async function teacherForEntry(store, code) {
  if (!validTeacherCode(code) || !store?.teacherByCode) return null;
  try { return await store.teacherByCode(code); } catch (e) {
    console.error('[olimpiada] teacher lookup:', e?.message || e);
    return null;
  }
}

// Учень за посиланням педагога пройшов тест. Перший — лист педагогові з
// подякою (його «бронює» thanks_sent_at); далі число на подяці росте само.
// Ніколи не кидає: здача тесту важливіша за лист.
export async function thankTeacher(store, code) {
  try {
    const teacher = await teacherForEntry(store, code);
    if (!teacher || teacher.thanks_sent_at) return false;
    const count = await store.teacherFinished(code);
    if (count < 1) return false;
    return await sendTeacherThanks(store, teacher, count);
  } catch (e) {
    console.error('[olimpiada] teacher thanks:', e?.message || e);
    return false;
  }
}

export const isOlimpOrder = (ref) => String(ref || '').startsWith('olimp-');
// Замовлення друкованого диплома — окремий рахунок того самого учасника.
export const isPrintOrder = (ref) => String(ref || '').startsWith('olimp-d-');

// Друкований диплом оплачено: позначаємо й надсилаємо адмінці все, що треба
// для відправлення, — отримувача, відділення й посилання на сам диплом.
const printNotice = (entry, note = '') => {
  const o = entry.print_order || {};
  return `📮 <b>Олімпіада: друкований диплом${note}</b>\n`
    + `${esc(entry.child_name)} · ${esc(entry.score)} з ${esc(entry.max_score)}\n`
    + `Отримувач: ${esc(o.name)}\nТелефон: ${esc(o.phone)}\n`
    + `${esc(o.city)}, Нова пошта: ${esc(o.branch)}\n`
    + `Диплом: ${SITE_URL}/api/olimpiada/diploma?t=${entry.token}&dl=1`;
};

export async function markPrintPaid(store, entry, { test = false } = {}) {
  if (entry.print_paid_at) return entry;
  const updated = await store.claim(entry.token, 'print_paid_at', { print_paid_at: new Date().toISOString() });
  if (!updated) return (await store.get(entry.token)) || entry;
  if (!test) await notifyAdmin(printNotice(updated));
  // Друкований диплом — у журнал оплат (08.10.2026).
  if (!test && updated.print_ref) {
    await store.recordPayment?.({
      order_reference: updated.print_ref, tx_key: updated.print_ref,
      amount: OLIMP.printPrice, product: 'olimp_print', paid_at: updated.print_paid_at,
      email: updated.parent_email || null, name: updated.child_name || null, olimp_token: updated.token,
    });
  }
  return updated;
}

// Доставку оплатили разом з участю (249 грн, до 08.10.2026) — після тесту батьки
// лише вказують адресу; рахунку вже не треба.
export async function savePrintAddress(store, entry, order) {
  const updated = await store.update(entry.token, { print_order: order });
  await notifyAdmin(printNotice({ ...entry, print_order: order }, ' (оплачено разом з участю)'));
  return updated || entry;
}

// Колбек WayForPay про платіж олімпіади. Його викликають обидва маршрути:
// свій (/api/olimpiada/pay — serviceUrl у рахунку) і колбек підписки
// (/api/pay/wayforpay) — на випадок, якщо в кабінеті WayForPay адреса
// колбека задана на весь магазин і serviceUrl із рахунку не діє.
// Токен учасника зашитий у номер замовлення (olimp-<токен>-<мс>,
// olimp-d-<токен>-<мс>). Шукаємо й за ним: якщо батьки двічі відкрили оплату
// й заплатили за першим рахунком, у записі вже стоїть номер другого — без
// цього платіж «загубився б» (перевірка перед стартом, 06.10.2026).
export const tokenFromOlimpRef = (ref) => (String(ref || '').match(/^olimp-(?:d-)?([0-9a-f]{32})-\d+$/) || [])[1] || null;

export async function handleOlimpCallback(b) {
  const store = getStore();
  if (!store) return;
  const byToken = async () => {
    const t = tokenFromOlimpRef(b.orderReference);
    return t ? store.get(t) : null;
  };
  if (isPrintOrder(b.orderReference)) {
    const entry = (await store.getByPrintRef(b.orderReference)) || (await byToken());
    if (entry && b.transactionStatus === 'Approved') await markPrintPaid(store, entry);
    return;
  }
  const entry = (await store.getByOrder(b.orderReference)) || (await byToken());
  if (!entry) return;
  if (b.transactionStatus === 'Approved') {
    await markPaid(store, entry);
  } else if (!entry.paid_at) {
    await store.update(entry.token, {
      wfp_last_status: String(b.transactionStatus || '').slice(0, 40),
      wfp_last_reason: String(b.reason || '').slice(0, 200) || null,
    });
  }
}

// Статуси WayForPay, після яких цей рахунок уже точно не оплатять: можна
// виставляти новий. Решта (InProcessing, Pending, WaitingAuthComplete…) —
// оплата ще йде, і нова заявка означала б, що батьки заплатять двічі.
export const OLIMP_PAY_FAILED = ['Declined', 'Expired'];
export const payFailed = (status) => OLIMP_PAY_FAILED.includes(String(status || ''));

// Оплату не підтверджено — питаємо WayForPay самі, не чекаючи колбека: він
// буває затримується, а людина тим часом бачила «оплата не підтвердилась» і
// платила вдруге (перевірка перед стартом, 07.10.2026). Approved — та сама
// markPaid, що й у колбеку; інше — лише записуємо статус.
// state: paid | pending (оплата може ще пройти) | failed (цей рахунок уже не
// оплатять) | none (WayForPay про оплату не знає — платити не починали).
export async function syncPayment(store, entry) {
  if (!entry || entry.paid_at) return { entry, state: 'paid' };
  if (!entry.wfp_order_reference) return { entry, state: 'none' };
  if (!store || store.dev) return { entry, state: 'pending' };
  const r = await checkStatus(entry.wfp_order_reference);
  // Не вдалося спитати — нічого не обіцяємо й нового рахунку не даємо.
  if (r.error) return { entry, state: payFailed(entry.wfp_last_status) ? 'failed' : 'pending' };
  if (!r.status) return { entry, state: payFailed(entry.wfp_last_status) ? 'failed' : 'none' };
  if (r.status === 'Approved') {
    const paid = await markPaid(store, entry);
    return { entry: paid, state: paid?.paid_at ? 'paid' : 'pending' };
  }
  const state = payFailed(r.status) ? 'failed' : 'pending';
  if (r.status === entry.wfp_last_status) return { entry, state };
  const updated = await store.update(entry.token, {
    wfp_last_status: String(r.status).slice(0, 40),
    wfp_last_reason: String(r.raw?.reason || '').slice(0, 200) || null,
  });
  return { entry: updated || entry, state };
}

// Те саме для оплати друкованого диплома.
export async function syncPrint(store, entry) {
  if (!store || store.dev || !entry || entry.print_paid_at || !entry.print_ref) return { entry, pending: false };
  const r = await checkStatus(entry.print_ref);
  if (r.status === 'Approved') return { entry: await markPrintPaid(store, entry), pending: false };
  // Рахунок відкрито, але WayForPay про оплату ще не знає або вона в процесі —
  // форму доставки знову не показуємо, щоб не заплатили вдруге.
  return { entry, pending: Boolean(r.status) && !payFailed(r.status) };
}

// Рахунок WayForPay за участь — лише для старих платних заявок (до 08.10.2026)
// у «Оплатити ще раз»; нові заявки безкоштовні й рахунку не мають. Номер замовлення щоразу новий: WayForPay не приймає повторів.
export async function createEntryInvoice(entry) {
  const bundle = isBundle(entry);
  const orderReference = `olimp-${entry.token}-${Date.now()}`;
  const inv = await createOneTimeInvoice({
    orderReference,
    amount: Number(entry.amount),
    product: bundle
      ? `Онлайн-олімпіада з логіки Dityam.com.ua (${OLIMP.groupLabel}) + друкований диплом із доставкою Новою поштою`
      : `Організаційний внесок: онлайн-олімпіада з логіки Dityam.com.ua (${OLIMP.groupLabel})`,
    email: entry.parent_email,
    returnUrl: `${SITE_URL}/api/olimpiada/return?t=${entry.token}`,
    serviceUrl: `${SITE_URL}/api/olimpiada/pay`,
  });
  return { ...inv, orderReference };
}

export const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
