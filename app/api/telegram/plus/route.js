// Вебхук окремого платного бота @DityamPlusBot.
// Модель «спочатку оплата, потім форма»: /start → якщо не оплачено, пропонуємо
// оплату (WayForPay); після успішної оплати відкривається діалогова форма профілю.
import { createClient } from '@supabase/supabase-js';
import { makeBot, beginFlow, handleFlowCallback } from '@/lib/digestFlow';
import { createInvoice, wayforpayConfigured, PRICE, PRICE_YEAR } from '@/lib/wayforpay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.TELEGRAM_PLUS_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_PLUS_WEBHOOK_SECRET;
const MAIN_TOKEN = process.env.TELEGRAM_BOT_TOKEN;         // для сповіщень адміну
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function GET() {
  return new Response('dityam plus bot', { status: 200 });
}

async function sendPayOffer(bot, sub, chatId) {
  const text = '🧡 <b>Dityam+ — персональні можливості для дитини</b>\n\n'
    + '• ⚡ сповіщення <b>щойно зʼявляється</b> можливість під вік та інтереси дитини\n'
    + '• 📝 підтримка у поданні заявок\n'
    + '• 🎁 подарунки від партнерів\n\n'
    + 'Обери план — і одразу налаштуємо профіль дитини.';
  if (wayforpayConfigured && sub) {
    const [m, y] = await Promise.all([createInvoice(sub, 'monthly'), createInvoice(sub, 'yearly')]);
    const rows = [];
    if (m.url) rows.push([{ text: `💳 Місяць — ${PRICE} грн`, url: m.url }]);
    if (y.url) rows.push([{ text: `⭐ Рік — ${PRICE_YEAR} грн (вигідніше)`, url: y.url }]);
    if (rows.length) { await bot.sendMessage(chatId, text, { inline_keyboard: rows }); return; }
  }
  await bot.sendMessage(chatId, `${text}\n\n⏳ Оплата підключається — зовсім скоро.`);
}

export async function POST(request) {
  if (!SECRET) return new Response('secret not configured', { status: 500 });
  if (request.headers.get('x-telegram-bot-api-secret-token') !== SECRET) return new Response('forbidden', { status: 403 });
  if (!SUPABASE_URL || !SERVICE_ROLE || !TOKEN) return new Response('server misconfigured', { status: 500 });

  const update = await request.json().catch(() => null);
  const bot = makeBot(TOKEN);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const msg = update?.message;
  if (msg?.text) {
    const chatId = String(msg.chat.id);
    const handle = msg.from?.username ? `@${msg.from.username}` : null;
    const text = msg.text.trim();

    if (/^\/stop\b/i.test(text)) {
      await supabase.from('digest_subscribers').update({ status: 'unsubscribed', updated_at: new Date().toISOString() }).eq('telegram_chat_id', chatId);
      await bot.sendMessage(chatId, 'Відписано ✅ Повернутись — /start');
      return new Response('ok');
    }

    if (/^\/start\b/i.test(text)) {
      let { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
      if (!sub) {
        const { data: ins } = await supabase.from('digest_subscribers')
          .insert({ telegram_chat_id: chatId, channel: 'telegram', telegram_handle: handle, status: 'pending' })
          .select('*').single();
        sub = ins;
      }
      if (sub?.status === 'active') {
        await beginFlow(bot, supabase, chatId, handle);       // вже оплачено → форма
      } else {
        await sendPayOffer(bot, sub, chatId);                 // ще ні → оплата
      }
      return new Response('ok');
    }

    if (/^\/(support|help|menu)\b/i.test(text)) {
      const { data: sub } = await supabase.from('digest_subscribers').select('status').eq('telegram_chat_id', chatId).maybeSingle();
      if (/^\/support\b/i.test(text)) {
        await bot.sendMessage(chatId, sub?.status === 'active'
          ? '📝 <b>Підтримка у поданні</b>\nНапиши своє питання прямо сюди — і ми допоможемо з заявкою.'
          : 'Підтримка у поданні доступна підписникам Dityam+. Оформити — /start 🧡');
      } else {
        await bot.sendMessage(chatId, '🧡 <b>Dityam+ — меню</b>\n\n/start — оформити або змінити профіль дитини\n/support — підтримка у поданні заявки\n/stop — відписатися');
      }
      return new Response('ok');
    }

    // Підтримка у поданні: будь-який інший текст від активного підписника → адміну.
    if (!text.startsWith('/')) {
      const { data: sub } = await supabase.from('digest_subscribers').select('status, telegram_handle').eq('telegram_chat_id', chatId).maybeSingle();
      if (sub?.status === 'active') {
        if (MAIN_TOKEN && ADMIN_CHAT_ID) {
          await makeBot(MAIN_TOKEN).sendMessage(ADMIN_CHAT_ID, `📝 <b>Питання підписника Dityam+</b> ${esc(sub.telegram_handle || '')} <code>${chatId}</code>:\n\n${esc(text.slice(0, 700))}`);
        }
        await bot.sendMessage(chatId, '📝 Отримали! Ми на звʼязку — відповімо тут найближчим часом. 🧡');
      }
    }
    return new Response('ok');
  }

  const cbq = update?.callback_query;
  if (!cbq) return new Response('ok');

  if ((cbq.data || '').startsWith('flow:')) {
    const chatId = String(cbq.message.chat.id);
    const { data: sub } = await supabase.from('digest_subscribers').select('status').eq('telegram_chat_id', chatId).maybeSingle();
    if (sub?.status !== 'active') { await bot.answerCallback(cbq.id, 'Спершу оформи підписку — /start'); return new Response('ok'); }
    await handleFlowCallback(bot, supabase, cbq);
    return new Response('ok');
  }

  await bot.answerCallback(cbq.id);
  return new Response('ok');
}
