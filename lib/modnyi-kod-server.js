// «Модний код» — серверна частина платної олімпіади (12.10.2026, запуск).
// Таблиця mk_entries (міграція 20261012_modnyi_kod_entries.sql), ключі —
// olimpiada_keys (olimp = 'modnyi-kod'), оплата — WayForPay, номер
// замовлення mk-<токен>-<час>. Кожна оплата — у журнал payments (mk_entry) й
// в адмін-чат; батькам — лист із посиланням на кабінет.
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { makeBot } from './digestFlow.js';
import { send, MAIL_FROM } from './olimpiada-mail.js';
import { createOneTimeInvoice, checkStatus } from './wayforpay.js';
import { recordPayment } from './payments.js';
import { loadKeys } from './olimpiada-server.js';
import { MK, tokenFromMkRef, mkCabinet } from './modnyi-kod.js';

export const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const TABLE = 'mk_entries';
const freshFetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function mkDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: freshFetch } });
}

export const mkKeys = () => loadKeys(MK.slug);

export async function notifyAdmin(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chat) return;
  try { await makeBot(token).sendMessage(chat, text); } catch { /* сповіщення не має ламати оплату */ }
}

/** Подія воронки з сервера (оплата підтверджена тощо) — у ту саму site_events. */
export async function serverEvent(db, name, source = null) {
  try { await db.from('site_events').insert(source ? { name, source } : { name }); } catch { /* лічильник — не привід падати */ }
}

export async function entryByToken(db, token) {
  const { data, error } = await db.from(TABLE).select('*').eq('token', token).maybeSingle();
  if (error) throw new Error(`mk: ${error.message}`);
  return data || null;
}

export async function updateEntry(db, token, patch) {
  const { data, error } = await db.from(TABLE).update({ ...patch, updated_at: new Date().toISOString() }).eq('token', token).select('*').maybeSingle();
  if (error) throw new Error(`mk: ${error.message}`);
  return data;
}

export async function recentCount(db, email) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await db.from(TABLE).select('id', { count: 'exact', head: true }).eq('parent_email', email).gte('created_at', since);
  return count || 0;
}

export async function createEntry(db, entry, source) {
  const token = crypto.randomBytes(16).toString('hex');
  const { data, error } = await db.from(TABLE).insert({ ...entry, token, amount: MK.price, source: source ? String(source).slice(0, 60) : null }).select('*').single();
  if (error) throw new Error(`mk insert: ${error.message}`);
  return data;
}

export async function startPayment(db, row) {
  if (row.paid_at) return { paid: true };
  const orderReference = `mk-${row.token}-${Date.now()}`;
  const inv = await createOneTimeInvoice({
    orderReference,
    amount: Number(row.amount) || MK.price,
    product: `Організаційний внесок: онлайн-олімпіада з моди «${MK.title}» (Dityam.com.ua)`,
    email: row.parent_email,
    returnUrl: `${SITE_URL}/api/modnyi-kod/return?t=${row.token}`,
    serviceUrl: `${SITE_URL}/api/modnyi-kod/pay`,
  });
  if (inv.error) return { error: inv.error };
  await updateEntry(db, row.token, { wfp_order_reference: orderReference });
  return { url: inv.url };
}

function inviteMail(row) {
  const link = `${SITE_URL}${mkCabinet(row.token)}`;
  const subject = `«${MK.title}»: оплату отримали — ${row.child_name} може починати`;
  const text = [
    'Добрий день!', '',
    `Оргвнесок ${MK.price} грн отримали — ${row.child_name} бере участь в онлайн-олімпіаді з моди «${MK.title}».`,
    `Кабінет учасника (тест, студія образу, обкладинка): ${link}`, '',
    `Тест — 25 завдань, ${MK.minutes} хвилин, 1 спроба; почати можна в зручний час. Після тесту — онлайн-студія образу, а потім обкладинка з балами для друку А4.`,
    `До початку тесту від участі можна відмовитися й повернути ${MK.price} грн — просто відповідайте на цей лист.`, '',
    'Марія Шутяк, Dityam.com.ua', MAIL_FROM,
  ].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px">
<p>Добрий день!</p>
<p>Оргвнесок ${MK.price} грн отримали — <b>${esc(row.child_name)}</b> бере участь в онлайн-олімпіаді з моди «${esc(MK.title)}».</p>
<p><a href="${esc(link)}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#f5c518;color:#2a0f38;font-weight:bold;text-decoration:none">Відкрити кабінет учасника</a></p>
<p>Тест — 25 завдань, ${MK.minutes} хвилин, 1 спроба; почати можна в зручний час. Після тесту — онлайн-студія образу, а потім обкладинка з балами для друку А4.</p>
<p style="color:#555;font-size:14px">До початку тесту від участі можна відмовитися й повернути ${MK.price} грн — просто відповідайте на цей лист.</p>
<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:${esc(MAIL_FROM)}">${esc(MAIL_FROM)}</a></p></div>`;
  return { subject, text, html };
}

/** Оплату підтверджено. Бере її лише 1 виклик (paid_at ще порожній). */
export async function markPaid(db, row, orderReference = row.wfp_order_reference) {
  if (row.paid_at) return row;
  const now = new Date().toISOString();
  const { data: paid } = await db.from(TABLE).update({ paid_at: now, wfp_last_status: 'Approved', updated_at: now })
    .eq('token', row.token).is('paid_at', null).select('*').maybeSingle();
  if (!paid) return (await entryByToken(db, row.token)) || row;
  await recordPayment(db, {
    order_reference: orderReference || `mk-${paid.token}`, tx_key: orderReference || `mk-${paid.token}`,
    amount: Number(paid.amount) || MK.price, product: 'mk_entry', paid_at: now,
    email: paid.parent_email || null, name: paid.child_name || null,
  });
  await serverEvent(db, 'mk_paid', paid.source || null);
  await notifyAdmin(`👗 <b>«${MK.title}»: оплата ${Number(paid.amount) || MK.price} грн</b>\n${esc(paid.child_name)}, ${paid.child_age} · ${esc(paid.parent_email)}`);
  try {
    const r = await send({ to: paid.parent_email, ...inviteMail(paid) });
    if (r?.ok) await updateEntry(db, paid.token, { invite_sent_at: new Date().toISOString() });
  } catch (e) { console.error('[mk/mail]', e?.message || e); }
  return paid;
}

// Тестове проходження для адміна (Марія, 13.10.2026: «дай мені повністю флоу,
// я буду реєструватися на сторінці і переходити в тг»): без WayForPay, сума 0,
// source 'admin_test'. Лист із кабінетом — той самий, що після оплати. У журнал
// оплат, воронку й адмін-чат не йде, щоб не рахувати тест продажем.
export async function adminTestPaid(db, row) {
  const now = new Date().toISOString();
  const paid = await updateEntry(db, row.token, { amount: 0, paid_at: now, wfp_last_status: 'Test', source: 'admin_test' });
  try {
    const r = await send({ to: row.parent_email, ...inviteMail(paid || row) });
    if (r?.ok) await updateEntry(db, row.token, { invite_sent_at: new Date().toISOString() });
  } catch (e) { console.error('[mk/mail]', e?.message || e); }
  return paid || row;
}

export async function handleMkCallback(b) {
  const db = mkDb();
  if (!db) return;
  const token = tokenFromMkRef(b.orderReference);
  if (!token) return;
  const row = await entryByToken(db, token);
  if (!row) return;
  if (b.transactionStatus === 'Approved') await markPaid(db, row, b.orderReference);
  else if (!row.paid_at) await updateEntry(db, token, { wfp_last_status: String(b.transactionStatus || '').slice(0, 40) });
}

/** Людина повернулась з оплати раніше за колбек — звіряємо з WayForPay. */
export async function syncPayment(db, row) {
  if (!row || row.paid_at || !row.wfp_order_reference) return row;
  const r = await checkStatus(row.wfp_order_reference);
  if (r.status === 'Approved') return markPaid(db, row);
  if (r.status && r.status !== row.wfp_last_status) return (await updateEntry(db, row.token, { wfp_last_status: String(r.status).slice(0, 40) })) || row;
  return row;
}

// ── Dityam+ (12.10.2026) ─────────────────────────────────────────────────────
// Підписник Dityam+ отримує «Модний код» у підписці: реєстрація в боті, без
// email і без оплати; офіційна спроба — 1 (на обкладинку), тренування — без
// обмежень (lib: practice). Запис позначаємо source = 'dityam_plus'.
export async function plusActive(db, chatId) {
  if (!chatId) return false;
  const { data } = await db.from('digest_subscribers').select('status').eq('telegram_chat_id', String(chatId)).maybeSingle();
  return data?.status === 'active';
}

export async function plusEntries(db, chatId) {
  const { data } = await db.from(TABLE).select('token, child_name, child_age, finished_at, score, max_score, look_at')
    .eq('telegram_chat_id', String(chatId)).order('created_at', { ascending: true });
  return data || [];
}

export async function createPlusEntry(db, { chatId, name, age }) {
  const token = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const { data, error } = await db.from(TABLE).insert({
    token, child_name: name, child_age: age, telegram_chat_id: String(chatId),
    amount: 0, paid_at: now, wfp_last_status: 'Plus', source: 'dityam_plus',
  }).select('*').single();
  if (error) throw new Error(`mk plus: ${error.message}`);
  await serverEvent(db, 'mk_plus_join');
  return data;
}
