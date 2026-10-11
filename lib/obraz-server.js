// Серверна частина челенджу «Намалюй свій образ»: таблиця obraz_entries і
// бакет obraz у Supabase (міграція 20261011_obraz_gallery.sql). Лише для
// API-маршрутів і серверних сторінок — тут сервісний ключ.
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { makeBot } from './digestFlow.js';
import { send, MAIL_FROM } from './olimpiada-mail.js';
import { OBRAZ, buildPublishedMail, buildRejectedMail } from './obraz.js';

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

// Що бачить сайт. Email батьків і токен на публічні сторінки не йдуть.
export const PUBLIC_FIELDS = 'public_id, theme, child_name, age, title, story, award, image_path, reviewed_at';

/** Скільки заявок з цієї пошти за добу — ліміт безкоштовної форми. */
export async function recentCount(db, email) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await db.from(TABLE).select('id', { count: 'exact', head: true })
    .eq('parent_email', email).gte('created_at', since);
  if (error) throw new Error(`obraz: ${error.message}`);
  return count || 0;
}

/** Файл — у бакет, рядок — у таблицю (status pending). */
export async function createEntry(db, entry, jpeg, { source = null } = {}) {
  const publicId = hex(5);
  const token = hex(16);
  // Випадкова частина в імені файлу: адресу не вгадати за public_id.
  const path = `${OBRAZ.theme.key}/${publicId}-${hex(8)}.jpg`;
  const up = await db.storage.from(OBRAZ.bucket).upload(path, jpeg, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw new Error(`obraz upload: ${up.error.message}`);
  const { data, error } = await db.from(TABLE).insert({
    ...entry, public_id: publicId, token, theme: OBRAZ.theme.key, image_path: path,
    source: source ? String(source).slice(0, 60) : null,
  }).select('*').single();
  if (error) {
    await db.storage.from(OBRAZ.bucket).remove([path]).catch(() => {});
    throw new Error(`obraz insert: ${error.message}`);
  }
  return data;
}

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

export async function entryByToken(db, token) {
  const { data, error } = await db.from(TABLE).select('*').eq('token', token).maybeSingle();
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
 * Рішення Марії в «Черзі»: approve — у галерею (з відзнакою чи без) і лист
 * «уже в галереї»; reject — файл видаляємо і пишемо батькам «надішліть ще
 * раз». Рішення бере лише запис у статусі pending: подвійне натискання
 * другого листа не надішле.
 */
export async function decide(db, id, { action, award = null }) {
  const status = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : null;
  if (!status) return { error: 'bad_request' };
  const { data: row, error } = await db.from(TABLE)
    .update({ status, award: status === 'approved' ? award : null, reviewed_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'pending').select('*').maybeSingle();
  if (error) return { error: 'server' };
  if (!row) return { error: 'already' };
  if (status === 'rejected') await db.storage.from(OBRAZ.bucket).remove([row.image_path]).catch(() => {});
  let mailed = false;
  try {
    const mail = (status === 'approved' ? buildPublishedMail : buildRejectedMail)(row, { site: SITE_URL, from: MAIL_FROM });
    const r = await send({ to: row.parent_email, ...mail });
    if (r?.ok) {
      mailed = true;
      await db.from(TABLE).update({ mail_sent_at: new Date().toISOString() }).eq('id', row.id);
    }
  } catch (e) {
    console.error('[obraz/mail]', e?.message || e);
  }
  return { ok: true, mailed };
}

export async function notifyAdmin(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chat) return;
  try { await makeBot(token).sendMessage(chat, text); } catch { /* сповіщення не має ламати заявку */ }
}
