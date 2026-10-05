// Серверна частина онлайн-олімпіади: сховище записів, оплата, сповіщення.
// Лише для API-маршрутів і серверних сторінок — тут сервісний ключ Supabase.
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { makeBot } from './digestFlow.js';
import { OLIMP } from './olimpiada.js';

export const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAIN_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const TABLE = 'olimpiada_entries';

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
    async createGift() { return crypto.randomBytes(16).toString('hex'); },
  };
}

function supabaseStore() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
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
    update: (token, patch) => one(supabase.from(TABLE)
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('token', token).select('*').maybeSingle()),
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

// Оплата підтверджена: ставимо позначку, заводимо подарунковий місяць Dityam+
// і кажемо адмінці. Повторний колбек WayForPay нічого не дублює.
export async function markPaid(store, entry, { test = false } = {}) {
  if (entry.paid_at) return entry;
  let plusToken = entry.plus_token || null;
  if (!plusToken) {
    try { plusToken = await store.createGift(entry); } catch (e) { console.error('[olimpiada] gift:', e); }
  }
  const updated = await store.update(entry.token, {
    paid_at: new Date().toISOString(), plus_token: plusToken, wfp_last_status: test ? 'Test' : 'Approved',
  });
  await notifyAdmin(
    `🧩 <b>Олімпіада: ${test ? 'тестовий запис' : 'оплата'}</b>\n`
    + `${esc(entry.child_name)}, ${esc(entry.child_age)} р.\n`
    + `${esc(entry.parent_email || '—')}${test ? '' : ` · внесок ${OLIMP.price} грн`}`,
  );
  return updated || entry;
}

export const isOlimpOrder = (ref) => String(ref || '').startsWith('olimp-');
// Замовлення друкованого диплома — окремий рахунок того самого учасника.
export const isPrintOrder = (ref) => String(ref || '').startsWith('olimp-d-');

// Друкований диплом оплачено: позначаємо й надсилаємо адмінці все, що треба
// для відправлення, — отримувача, відділення й посилання на сам диплом.
export async function markPrintPaid(store, entry, { test = false } = {}) {
  if (entry.print_paid_at) return entry;
  const updated = await store.update(entry.token, { print_paid_at: new Date().toISOString() });
  const o = entry.print_order || {};
  await notifyAdmin(
    `📮 <b>Олімпіада: друкований диплом${test ? ' (тест)' : ''}</b>\n`
    + `${esc(entry.child_name)} · ${esc(entry.score)} з ${esc(entry.max_score)}\n`
    + `Отримувач: ${esc(o.name)}\nТелефон: ${esc(o.phone)}\n`
    + `${esc(o.city)}, Нова пошта: ${esc(o.branch)}\n`
    + `Диплом: ${SITE_URL}/api/olimpiada/diploma?t=${entry.token}&dl=1`,
  );
  return updated || entry;
}

// Колбек WayForPay про платіж олімпіади. Його викликають обидва маршрути:
// свій (/api/olimpiada/pay — serviceUrl у рахунку) і колбек підписки
// (/api/pay/wayforpay) — на випадок, якщо в кабінеті WayForPay адреса
// колбека задана на весь магазин і serviceUrl із рахунку не діє.
export async function handleOlimpCallback(b) {
  const store = getStore();
  if (!store) return;
  if (isPrintOrder(b.orderReference)) {
    const entry = await store.getByPrintRef(b.orderReference);
    if (entry && b.transactionStatus === 'Approved') await markPrintPaid(store, entry);
    return;
  }
  const entry = await store.getByOrder(b.orderReference);
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

export const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
