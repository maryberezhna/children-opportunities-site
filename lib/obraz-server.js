// Серверна частина челенджу «Твій образ на обкладинці»: таблиця obraz_entries
// і бакет obraz у Supabase (міграції 20261011_obraz_*.sql), оргвнесок через
// WayForPay. Лише для API-маршрутів і серверних сторінок — тут сервісний ключ.
//
// Шлях заявки: форма → unpaid (фото вже в бакеті, обкладинка — превʼю) →
// оплата 99 грн → pending (у «Черзі» Марії) → approved (у галереї, лист з
// обкладинкою) або reupload (фото не підійшло — батьки надсилають інше без
// доплати → знову pending).
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { makeBot } from './digestFlow.js';
import { send, MAIL_FROM } from './olimpiada-mail.js';
import { createOneTimeInvoice, checkStatus } from './wayforpay.js';
import { recordPayment } from './payments.js';
import { fabricFor } from './obraz-cover.js';
import {
  OBRAZ, buildPublishedMail, buildPaidMail, buildReuploadMail, tokenFromObrazRef, obrazProductName,
} from './obraz.js';

export const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const TABLE = 'obraz_entries';

// Next кешує GET-запити до Supabase навіть на динамічних сторінках
// (memory: dityam-next-data-cache-supabase) — свіжий статус лише з no-store.
const freshFetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

export function obrazDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: freshFetch } });
}

const hex = (bytes) => crypto.randomBytes(bytes).toString('hex');
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Що бачить сайт. Email батьків і токен на публічні сторінки не йдуть.
export const PUBLIC_FIELDS = 'public_id, theme, child_name, age, title, story, award, image_path, reviewed_at, designer_word, fabric';

export async function notifyAdmin(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chat) return;
  try { await makeBot(token).sendMessage(chat, text); } catch { /* сповіщення не має ламати заявку */ }
}

async function mail(to, built) {
  try {
    const r = await send({ to, ...built });
    return Boolean(r?.ok);
  } catch (e) {
    console.error('[obraz/mail]', e?.message || e);
    return false;
  }
}

/** Скільки заявок з цієї пошти за добу — ліміт форми. */
export async function recentCount(db, email) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await db.from(TABLE).select('id', { count: 'exact', head: true })
    .eq('parent_email', email).gte('created_at', since);
  if (error) throw new Error(`obraz: ${error.message}`);
  return count || 0;
}

async function upload(db, publicId, jpeg) {
  // Випадкова частина в імені файлу: адресу не вгадати за public_id.
  const path = `${OBRAZ.theme.key}/${publicId}-${hex(8)}.jpg`;
  const up = await db.storage.from(OBRAZ.bucket).upload(path, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw new Error(`obraz upload: ${up.error.message}`);
  return path;
}

/** Файл — у бакет, рядок — у таблицю (unpaid: чекає оплати, у «Черзі» не видно). */
export async function createEntry(db, entry, jpeg, { source = null } = {}) {
  const publicId = hex(5);
  const token = hex(16);
  const path = await upload(db, publicId, jpeg);
  const { data, error } = await db.from(TABLE).insert({
    ...entry, public_id: publicId, token, theme: OBRAZ.theme.key, image_path: path,
    fabric: fabricFor(publicId), amount: OBRAZ.price, status: 'unpaid',
    source: source ? String(source).slice(0, 60) : null,
  }).select('*').single();
  if (error) {
    await db.storage.from(OBRAZ.bucket).remove([path]).catch(() => {});
    throw new Error(`obraz insert: ${error.message}`);
  }
  return data;
}

/**
 * Нове фото до тієї самої заявки — коли Марія попросила інше (reupload) або
 * ще до оплати. Оплачена заявка знову йде в «Чергу», доплати немає.
 */
export async function replacePhoto(db, row, jpeg) {
  if (!['unpaid', 'reupload'].includes(row.status)) return { error: 'not_allowed' };
  const path = await upload(db, row.public_id, jpeg);
  const next = row.paid_at ? 'pending' : 'unpaid';
  const { data, error } = await db.from(TABLE)
    .update({ image_path: path, status: next, reupload_at: new Date().toISOString() })
    .eq('id', row.id).eq('status', row.status).select('*').maybeSingle();
  if (error || !data) {
    await db.storage.from(OBRAZ.bucket).remove([path]).catch(() => {});
    return { error: 'already' };
  }
  await db.storage.from(OBRAZ.bucket).remove([row.image_path]).catch(() => {});
  if (next === 'pending') {
    await notifyAdmin(`🎨 <b>Нове фото на перевірку</b> (замість невдалого)\n${escHtml(data.child_name)}, ${data.age} · «${escHtml(data.title)}»\nhttps://dityam.com.ua/admin`);
  }
  return { row: data };
}

export async function entryByToken(db, token) {
  const { data, error } = await db.from(TABLE).select('*').eq('token', token).maybeSingle();
  if (error) throw new Error(`obraz: ${error.message}`);
  return data || null;
}

// ── Оплата ──────────────────────────────────────────────────────────────────

/** Рахунок WayForPay на оргвнесок. Номер замовлення: obraz-<токен>-<час>. */
export async function startPayment(db, row) {
  if (row.paid_at) return { paid: true };
  const orderReference = `obraz-${row.token}-${Date.now()}`;
  const inv = await createOneTimeInvoice({
    orderReference,
    amount: Number(row.amount) || OBRAZ.price,
    product: obrazProductName(),
    email: row.parent_email,
    returnUrl: `${SITE_URL}/api/obraz/return?t=${row.token}`,
    serviceUrl: `${SITE_URL}/api/obraz/pay`,
  });
  if (inv.error) return { error: inv.error };
  await db.from(TABLE).update({ wfp_order_reference: orderReference }).eq('id', row.id);
  return { url: inv.url };
}

/**
 * Оплату підтверджено (колбек або звірка CHECK_STATUS). Бере її лише один
 * виклик — запис, де paid_at ще порожній, — тож повторний колбек не дублює
 * ні журналу, ні листа, ні повідомлення в адмін-чат.
 */
export async function markPaid(db, row, { orderReference = row.wfp_order_reference } = {}) {
  if (row.paid_at) return row;
  const now = new Date().toISOString();
  const { data: paid } = await db.from(TABLE)
    .update({ paid_at: now, wfp_last_status: 'Approved', status: row.status === 'unpaid' ? 'pending' : row.status })
    .eq('id', row.id).is('paid_at', null).select('*').maybeSingle();
  if (!paid) return (await entryByToken(db, row.token)) || row;
  await recordPayment(db, {
    order_reference: orderReference || `obraz-${paid.token}`, tx_key: orderReference || `obraz-${paid.token}`,
    amount: Number(paid.amount) || OBRAZ.price, product: 'obraz_entry', paid_at: now,
    email: paid.parent_email || null, name: paid.child_name || null,
  });
  await notifyAdmin(`🎨 <b>Обкладинка: оплата ${Number(paid.amount) || OBRAZ.price} грн</b>\n`
    + `${escHtml(paid.child_name)}, ${paid.age} · «${escHtml(paid.title)}»\n${escHtml(paid.parent_email)}\nМалюнок чекає в «Черзі»: https://dityam.com.ua/admin`);
  await mail(paid.parent_email, buildPaidMail(paid, { site: SITE_URL, from: MAIL_FROM }));
  return paid;
}

export async function handleObrazCallback(b) {
  const db = obrazDb();
  if (!db) return;
  const token = tokenFromObrazRef(b.orderReference);
  if (!token) return;
  const row = await entryByToken(db, token);
  if (!row) return;
  if (b.transactionStatus === 'Approved') {
    await markPaid(db, row, { orderReference: b.orderReference });
  } else if (!row.paid_at) {
    await db.from(TABLE).update({
      wfp_last_status: String(b.transactionStatus || '').slice(0, 40),
      wfp_last_reason: String(b.reason || '').slice(0, 200) || null,
    }).eq('id', row.id);
  }
}

/** Звірка на сторінці заявки: людина повернулась з оплати раніше за колбек. */
export async function syncPayment(db, row) {
  if (!row || row.paid_at || !row.wfp_order_reference) return row;
  const r = await checkStatus(row.wfp_order_reference);
  if (r.status === 'Approved') return markPaid(db, row);
  return row;
}

// ── Галерея ─────────────────────────────────────────────────────────────────

/** Опубліковані малюнки для галереї, свіжі зверху. */
export async function approvedWorks(db, { theme = null, from = null, to = null, limit = 300 } = {}) {
  let q = db.from(TABLE).select(PUBLIC_FIELDS).eq('status', 'approved');
  if (theme) q = q.eq('theme', theme);
  if (from) q = q.gte('age', from);
  if (to) q = q.lte('age', to);
  const { data, error } = await q.order('reviewed_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`obraz: ${error.message}`);
  return data || [];
}

export async function workByPublicId(db, publicId) {
  const { data, error } = await db.from(TABLE).select(PUBLIC_FIELDS).eq('public_id', publicId).eq('status', 'approved').maybeSingle();
  if (error) throw new Error(`obraz: ${error.message}`);
  return data || null;
}

/** Батьки прибирають малюнок самі: рядок лишається (removed), файл — ні. */
export async function removeByToken(db, token) {
  const row = await entryByToken(db, token);
  if (!row) return null;
  if (row.status !== 'removed') {
    await db.storage.from(OBRAZ.bucket).remove([row.image_path]).catch(() => {});
    await db.from(TABLE).update({ status: 'removed', removed_at: new Date().toISOString() }).eq('id', row.id);
  }
  return row;
}

/**
 * Рішення Марії в «Черзі»: approve — у галерею (з відзнакою чи без) і лист з
 * обкладинкою; reject — фото не підійшло: файл видаляємо, батькам — «надішліть
 * інше, без доплати» (reupload). Рішення бере лише оплачений запис у статусі
 * pending: подвійне натискання другого листа не надішле.
 */
export async function decide(db, id, { action, award = null }) {
  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'reupload' : null;
  if (!status) return { error: 'bad_request' };
  const { data: row, error } = await db.from(TABLE)
    .update({ status, award: status === 'approved' ? award : null, reviewed_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending').select('*').maybeSingle();
  if (error) return { error: 'server' };
  if (!row) return { error: 'already' };
  if (status === 'reupload') await db.storage.from(OBRAZ.bucket).remove([row.image_path]).catch(() => {});
  const built = (status === 'approved' ? buildPublishedMail : buildReuploadMail)(row, { site: SITE_URL, from: MAIL_FROM });
  const mailed = await mail(row.parent_email, built);
  if (mailed) await db.from(TABLE).update({ mail_sent_at: new Date().toISOString() }).eq('id', row.id);
  return { ok: true, mailed };
}
