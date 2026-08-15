import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

/**
 * Лист очікування Dityam+. Продаж на паузі — збираємо email тих, хто хоче
 * дізнатись про запуск першим (і отримати бонус за терпіння).
 */
export async function POST(request) {
  const b = await request.json().catch(() => ({}));

  // Honeypot — людина поля не бачить, бот заповнює.
  if (b.website) return Response.json({ ok: true });

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase().slice(0, 200) : '';
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ ok: false, error: 'bad_email' }, { status: 400 });
  }
  const source = typeof b.source === 'string' ? b.source.slice(0, 60) : null;

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(sbUrl, key, { auth: { persistSession: false } });

  const { error } = await supabase
    .from('plus_waitlist')
    .upsert({ email, source }, { onConflict: 'email' });
  if (error) return Response.json({ ok: false, error: 'server' }, { status: 500 });

  // Сповіщення адміну — best effort: запис у базі вже є.
  if (BOT_TOKEN && ADMIN_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: `📬 <b>Dityam+ — новий у списку очікування</b>\n${email}${source ? `\n<i>${source}</i>` : ''}`,
          parse_mode: 'HTML',
        }),
      });
    } catch (e) { /* база важливіша за сповіщення */ }
  }

  return Response.json({ ok: true });
}
