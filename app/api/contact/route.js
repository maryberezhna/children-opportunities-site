import { createClient } from '@supabase/supabase-js';
import { CONTACT_TYPE_MAP, isValidContactType } from '@/lib/contactTypes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Звернення з контактної форми (/contacts). Пише в contact_messages і одразу
 * сповіщає адміна в Telegram: лист, що чекає, поки хтось згадає зазирнути в
 * таблицю, — це лист, на який не відповіли.
 */
export async function POST(request) {
  const b = await request.json().catch(() => ({}));

  // Honeypot: приховане поле, якого людина не бачить, а бот заповнює.
  // Відповідаємо «ок», щоб спамер не зрозумів, що його відсіяли.
  if (b.website) return Response.json({ ok: true });

  const type = isValidContactType(b.type) ? b.type : 'other';
  const message = str(b.message, 4000);
  const name = str(b.name, 200);
  const contact = str(b.contact, 200);
  const url = str(b.url, 500);
  const page = str(b.page, 300);

  if (message.length < 10) {
    return Response.json({ ok: false, error: 'short' }, { status: 400 });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(sbUrl, key, { auth: { persistSession: false } });

  const { error } = await supabase.from('contact_messages').insert({
    type,
    name: name || null,
    contact: contact || null,
    message,
    url: url || null,
    page: page || null,
  });
  if (error) return Response.json({ ok: false, error: 'server' }, { status: 500 });

  // Сповіщення — best effort: якщо Telegram упав, звернення вже збережене,
  // тож користувачу помилку не показуємо.
  if (BOT_TOKEN && ADMIN_CHAT_ID) {
    const t = CONTACT_TYPE_MAP[type];
    const lines = [
      `${t.emoji} <b>Нове звернення: ${esc(t.label)}</b>`,
      '',
      esc(message).slice(0, 1200),
      url ? `\n🔗 ${esc(url)}` : null,
      name || contact
        ? `\n👤 ${esc([name, contact].filter(Boolean).join(' · '))}`
        : '\n👤 <i>без контактів — відповісти не вийде</i>',
      page ? `\n📄 зі сторінки: ${esc(page)}` : null,
      '\n<a href="https://dityam.com.ua/admin/messages">Відкрити в адмінці →</a>',
    ].filter(Boolean);
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: lines.join('\n'),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
    } catch (e) { /* збережено в базі — цього досить */ }
  }

  return Response.json({ ok: true });
}
