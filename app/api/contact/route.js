import { createClient } from '@supabase/supabase-js';
import { CONTACT_TYPE_MAP, isValidContactType } from '@/lib/contactTypes';
import { parseContact, contactHref } from '@/lib/contactAddress';
import { isAfterHours, kyivTime } from '@/lib/working-hours';
import { autoReplyFor } from '@/lib/reply-templates';
import { send } from '@/lib/olimpiada-mail';

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

  // Службові типи (hidden, напр. 'bot') з форми не приймаємо.
  const type = isValidContactType(b.type) && !CONTACT_TYPE_MAP[b.type].hidden ? b.type : 'other';
  const message = str(b.message, 4000);
  const name = str(b.name, 200);
  const parsed = parseContact(str(b.contact, 200));
  const url = str(b.url, 500);
  const page = str(b.page, 300);
  // Дозвіл на публікацію має сенс лише для історії (імʼя під історією) і для
  // амбасадора (імʼя та місто на /ambasadory); без нього нічого не публікуємо.
  const consentType = type === 'story' || type === 'ambassador';
  const publishConsent = consentType && b.publish_consent === true;

  if (message.length < 10) {
    return Response.json({ ok: false, error: 'short' }, { status: 400 });
  }

  // Контакт обовʼязковий і на сервері: без нього не відповісти, а перевірка
  // лише в браузері спам не спиняє — боти шлють POST напряму. З 07.10.2026
  // лише email або нік у Telegram: на телефон відповісти нема як.
  if (!parsed) {
    return Response.json({ ok: false, error: 'contact' }, { status: 400 });
  }
  const contact = parsed.value;

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(sbUrl, key, { auth: { persistSession: false } });

  const { error } = await supabase.from('contact_messages').insert({
    type,
    name: name || null,
    contact,
    message,
    url: url || null,
    page: page || null,
    publish_consent: publishConsent,
  });
  if (error) return Response.json({ ok: false, error: 'server' }, { status: 500 });

  // Схвалений Марією шаблон відповідає сам (lib/reply-templates.js, з
  // 23.10.2026): «все, що я апрувлю, — записуй у автоматичний процес».
  // Лише на email; best effort — звернення вже збережене, і якщо пошта
  // впала, адмін-чат це побачить і відповість руками.
  let autoReply = null;
  const tpl = autoReplyFor(type);
  if (tpl && parsed.kind === 'email') {
    try {
      // Уже педагог олімпіади (за поштою) — у листі посилання його класу,
      // а не «зареєструйтесь» (Тетяна Пупкова, 23.10.2026).
      const safe = contact.replace(/[\\%_]/g, (c) => `\\${c}`);
      const { data: tRows } = await supabase.from('olimpiada_teachers').select('name, code').ilike('email', safe).limit(1);
      const mail = tpl.build({ name, message, teacher: tRows?.[0] || null });
      const r = await send({ to: contact, ...mail, fromName: 'Марія Шутяк · Dityam.com.ua' });
      autoReply = r?.ok ? { ok: true, title: tpl.title } : { ok: false, title: tpl.title };
    } catch (e) {
      autoReply = { ok: false, title: tpl.title };
    }
  }

  // Поза робочим часом форма пише людині «відповімо в робочі години», а
  // адмін-чат бачить, що відповідь обіцяно на ранок (lib/working-hours.js).
  const now = new Date();
  const afterHours = isAfterHours(now);

  // Сповіщення — best effort: якщо Telegram упав, звернення вже збережене,
  // тож користувачу помилку не показуємо.
  if (BOT_TOKEN && ADMIN_CHAT_ID) {
    const t = CONTACT_TYPE_MAP[type];
    const lines = [
      `${t.emoji} <b>Нове звернення: ${esc(t.label)}</b>`,
      '',
      esc(message).slice(0, 1200),
      url ? `\n🔗 ${esc(url)}` : null,
      type === 'story' ? (publishConsent ? '\n✅ Можна опублікувати з іменем' : '\n🔒 Публікувати не можна') : null,
      type === 'ambassador' ? (publishConsent ? '\n✅ Можна вказати імʼя та місто на сторінці амбасадорів' : '\n🔒 Імʼя на сайті не показувати') : null,
      afterHours ? `\n🌙 Написали о ${kyivTime(now)} — людині обіцяли відповідь у робочі години` : null,
      autoReply ? (autoReply.ok
        ? `\n✉️ Автовідповідь надіслано за шаблоном «${esc(autoReply.title)}»`
        : `\n⚠️ Автовідповідь «${esc(autoReply.title)}» не пішла — відповісти руками`) : null,
      `\n👤 ${[name ? esc(name) : null, `<a href="${esc(contactHref(parsed))}">${esc(contact)}</a>`].filter(Boolean).join(' · ')}`,
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

  return Response.json({ ok: true, afterHours });
}
