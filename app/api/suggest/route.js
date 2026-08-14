import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Пропозиція можливості від відвідувача. Пише в opportunity_suggestions і
 * шле сповіщення адміну в Telegram — щоб пропозиція не чекала, поки хтось
 * згадає зазирнути в таблицю.
 */
export async function POST(request) {
  const b = await request.json().catch(() => ({}));

  // Honeypot: приховане поле, яке людина не бачить, а бот заповнює.
  // Відповідаємо «ок», щоб спамер не дізнався, що його відсіяли.
  if (b.website) return Response.json({ ok: true });

  const title = typeof b.title === 'string' ? b.title.trim().slice(0, 300) : '';
  const url = typeof b.url === 'string' ? b.url.trim().slice(0, 500) : '';
  const comment = typeof b.comment === 'string' ? b.comment.trim().slice(0, 2000) : '';
  const contact = typeof b.contact === 'string' ? b.contact.trim().slice(0, 200) : '';

  if (title.length < 5 && !url) {
    return Response.json({ ok: false, error: 'empty' }, { status: 400 });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(sbUrl, key, { auth: { persistSession: false } });

  const { error } = await supabase.from('opportunity_suggestions').insert({
    title: title || url,
    url: url || null,
    comment: comment || null,
    contact: contact || null,
  });
  if (error) return Response.json({ ok: false, error: 'server' }, { status: 500 });

  // Сповіщення адміну — best effort: якщо Telegram упав, пропозиція все одно
  // збережена, тож помилку тут не показуємо користувачу.
  if (BOT_TOKEN && ADMIN_CHAT_ID) {
    const lines = [
      '💡 <b>Нова пропозиція можливості</b>',
      '',
      `<b>${esc(title || url)}</b>`,
      url ? esc(url) : null,
      comment ? `\n${esc(comment)}` : null,
      contact ? `\nКонтакт: ${esc(contact)}` : null,
    ].filter(Boolean);
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ADMIN_CHAT_ID,
          text: lines.join('\n'),
          parse_mode: 'HTML',
          disable_web_page_preview: false,
        }),
      });
    } catch (e) { /* збережено в базі — цього досить */ }
  }

  return Response.json({ ok: true });
}
