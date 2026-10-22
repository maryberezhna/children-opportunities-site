import { createClient } from '@supabase/supabase-js';
import { makeBot } from '@/lib/digestFlow';
import { CONTACT_TYPE_MAP } from '@/lib/contactTypes';
import { WORK_FROM, REMIND_DAYS, afterHoursDigest } from '@/lib/working-hours';
import { kyivHour } from '@/lib/night-prompt';

/**
 * О 9:00 за Києвом — нагадування в адмін-чат про тих, хто написав після 18:00
 * (або вночі) і досі без відповіді.
 *
 * Марія, 22.10.2026: «всі хто нам пише питання після 18.00 — ми обовʼязково
 * відповідаємо у робочі години». Людині вже сказано «відповімо в робочі
 * години»; це нагадування — щоб обіцянка не загубилась серед вечірніх
 * сповіщень.
 *
 * Чому Vercel, а не GitHub Actions: тамтешній cron запізнюється на 4–6 годин,
 * і «о дев'ятій» перетворилось би на обід. Розклад у vercel.json — 06:00 і
 * 07:00 UTC, бо Київ то UTC+2, то UTC+3; надсилає лише той запуск, що
 * припав на 9:00 за Києвом.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const CRON_SECRET = process.env.CRON_SECRET;
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';

export async function GET(request) {
  if (CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return Response.json({ error: 'forbidden' }, { status: 401 });
    }
  }
  // Другий із двох запусків (не 9:00 за Києвом) нічого не робить.
  if (kyivHour() !== WORK_FROM) return Response.json({ skipped: 'not 9:00 Kyiv' });
  if (!SB_URL || !SB_KEY || !BOT_TOKEN || !ADMIN_CHAT_ID) {
    return Response.json({ error: 'missing env' }, { status: 500 });
  }

  const supabase = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
  const since = new Date(Date.now() - REMIND_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabase.from('contact_messages')
    .select('id, type, contact, message, created_at')
    .eq('status', 'new')
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const text = afterHoursDigest(rows, CONTACT_TYPE_MAP, SITE_URL);
  if (!text) return Response.json({ waiting: 0 });
  await makeBot(BOT_TOKEN).sendMessage(ADMIN_CHAT_ID, text);
  return Response.json({ sent: true });
}
