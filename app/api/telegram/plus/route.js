// Вебхук окремого платного бота @DityamPlusBot.
// Модель «спочатку оплата, потім форма»: /start → якщо не оплачено, пропонуємо
// оплату (WayForPay); після успішної оплати відкривається діалогова форма профілю.
import { createClient } from '@supabase/supabase-js';
import { makeBot, beginFlow, handleFlowCallback } from '@/lib/digestFlow';
import { createInvoice, wayforpayConfigured, removeRecurring, PRICE, PRICE_YEAR } from '@/lib/wayforpay';
import { matchThemes } from '@/lib/themes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN = process.env.TELEGRAM_PLUS_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_PLUS_WEBHOOK_SECRET;
const MAIN_TOKEN = process.env.TELEGRAM_BOT_TOKEN;         // для сповіщень адміну
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';
const AGE_RANGES = { '0-3': [0, 3], '4-6': [4, 6], '7-10': [7, 10], '11-14': [11, 14], '15-18': [15, 18] };
const ageOverlap = (from, to, bands) => !bands?.length || bands.some((b) => AGE_RANGES[b] && from <= AGE_RANGES[b][1] && to >= AGE_RANGES[b][0]);

export function GET() {
  // Діагностика: яку ціну/налаштування реально бачить жива функція на Vercel.
  return Response.json({ ok: true, price: PRICE, priceYear: PRICE_YEAR, wayforpay: wayforpayConfigured });
}

// Скасування підписки у WayForPay. hadOrder=false — платежу не було
// (людина так і не оплатила), тоді скасовувати нічого й це не помилка.
async function cancelSubscription(sub) {
  const ref = sub?.wfp_order_reference;
  if (!ref) return { ok: true, hadOrder: false };
  const r = await removeRecurring(ref);
  return { ...r, hadOrder: true };
}

// Живий доказ замість переліку обіцянок: дві найближчі можливості з бази.
// Людина бачить, що каталог справді працює, ще до оплати.
async function payoffProof(supabase) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from('opportunities')
    .select('title, deadline')
    .eq('status', 'active').is('canonical_slug', null)
    .not('deadline', 'is', null).gte('deadline', today)
    .order('deadline', { ascending: true }).limit(2);
  if (!data?.length) return '';
  const M = ['січ','лют','бер','квіт','трав','черв','лип','сер','вер','жовт','лист','груд'];
  const lines = data.map((o) => {
    const d = new Date(o.deadline);
    return `• ${esc(o.title.slice(0, 60))} — до ${d.getDate()} ${M[d.getMonth()]}`;
  });
  return `\n<b>Ось що зараз горить у каталозі:</b>\n${lines.join('\n')}\n`;
}

async function sendPayOffer(bot, sub, chatId, supabase) {
  // «Ви» — як на сайті. Раніше тут було «ти», і людина бачила два різні
  // тони в одному продукті.
  //
  // Свідомо НЕ обіцяємо «подарунки від партнерів»: у коді такого немає,
  // а обіцянка, яку нічим не закрити, коштує дорожче за зайвий рядок.
  const proof = supabase ? await payoffProof(supabase) : '';
  const text = '🧡 <b>Dityam+</b>\n\n'
    + 'Ви більше не шукаєте. Ми стежимо за каталогом щодня і пишемо, '
    + 'щойно зʼявляється щось саме для вашої дитини — поки подача ще відкрита.\n'
    + proof
    + '\n<b>Що входить:</b>\n'
    + '• Добірка під вік та інтереси — без шуму й зайвого\n'
    + '• Допомога із заявкою — напишіть сюди, підкажемо, що заповнювати\n'
    + '• Свіжі можливості на вимогу — будь-коли, одним дотиком у меню\n'
    + '• Telegram або email — куди вам зручніше\n\n'
    + '🔒 Не запитуємо дитячих даних — лише вік і теми\n'
    + '❌ Скасувати одним повідомленням, гроші більше не спишуться\n\n'
    + '💡 Швидше за все — <b>Apple Pay або Google Pay</b>: два дотики, без картки.';
  if (wayforpayConfigured && sub) {
    const [m, y] = await Promise.all([createInvoice(sub, 'monthly'), createInvoice(sub, 'yearly')]);
    const rows = [];
    if (m.url) rows.push([{ text: `Оформити за ${PRICE} грн/міс`, url: m.url }]);
    if (y.url) rows.push([{ text: `Рік за ${PRICE_YEAR} грн — вигідніше`, url: y.url }]);
    if (rows.length) { await bot.sendMessage(chatId, text, { inline_keyboard: rows }); return; }
  }
  await bot.sendMessage(chatId, `${text}\n\n⏳ Оплата підключається — зовсім скоро.`);
}

// Головне меню для активного підписника.
async function sendMainMenu(bot, chatId) {
  await bot.sendMessage(chatId, 'Вітаю! 🧡 Ви підписник <b>Dityam+</b>.\nЩо зробимо?', {
    inline_keyboard: [
      [{ text: '🔎 Останні можливості для дитини', callback_data: 'menu:latest' }],
      [{ text: '✏️ Оновити форму (що цікаво)', callback_data: 'menu:form' }],
      [{ text: '⭐ Деталі підписки', callback_data: 'menu:sub' }],
      [{ text: '📝 Питання в підтримку', callback_data: 'menu:support' }],
    ],
  });
}

// Останні можливості під профіль дитини (on-demand, топ-5).
async function sendLatest(bot, supabase, sub, chatId) {
  const { data: opps } = await supabase.from('opportunities')
    .select('title, slug, age_from, age_to, cost_type, summary, created_at')
    .eq('status', 'active').order('created_at', { ascending: false }).limit(200);
  const interests = new Set(sub.interests || []);
  const freeOnly = sub.cost_pref === 'free_only';
  const matched = (opps || []).filter((o) => {
    if (freeOnly && o.cost_type !== 'free') return false;
    if (!ageOverlap(o.age_from, o.age_to, sub.age_bands)) return false;
    if (interests.size) {
      const t = matchThemes(`${o.title} ${o.summary || ''}`);
      if (!t.some((x) => interests.has(x))) return false;
    }
    return true;
  }).slice(0, 5);
  if (!matched.length) {
    await bot.sendMessage(chatId, 'Поки немає нічого під профіль — щойно зʼявиться, напишемо першими. Можна розширити інтереси через «✏️ Оновити форму».');
    return;
  }
  const lines = ['🔎 <b>Останні можливості під вашу дитину</b>', ''];
  for (const o of matched) lines.push(`🔸 <a href="${SITE_URL}/o/${o.slug}">${esc(o.title)}</a>`);
  await bot.sendMessage(chatId, lines.join('\n'));
}

function subDetails(sub) {
  const ages = (sub.age_bands || []).length ? sub.age_bands.join(', ') : '—';
  const int = (sub.interests || []).length ? sub.interests.join(', ') : '—';
  return `⭐ <b>Ваша підписка Dityam+</b>\nСтатус: активна ✅\nВік дитини: ${esc(ages)}\nІнтереси: ${esc(int)}\n\nЗмінити профіль — «✏️ Оновити форму». Скасувати підписку — /stop.`;
}

export async function POST(request) {
  if (!SECRET) return new Response('secret not configured', { status: 500 });
  if (request.headers.get('x-telegram-bot-api-secret-token') !== SECRET) return new Response('forbidden', { status: 403 });
  if (!SUPABASE_URL || !SERVICE_ROLE || !TOKEN) return new Response('server misconfigured', { status: 500 });

  const update = await request.json().catch(() => null);
  const bot = makeBot(TOKEN);
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const msg = update?.message;

  // Користувач поділився номером (кнопка request_contact) → зберігаємо й пропонуємо оплату.
  if (msg?.contact) {
    const chatId = String(msg.chat.id);
    let phone = String(msg.contact.phone_number || '').replace(/[^\d+]/g, '');
    if (phone && !phone.startsWith('+')) phone = `+${phone}`;   // WayForPay любить міжнародний формат
    const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
    if (sub && sub.status !== 'active') {
      await supabase.from('digest_subscribers').update({ phone, flow_step: null, updated_at: new Date().toISOString() }).eq('id', sub.id);
      await bot.sendMessage(chatId, '✅ Дякую!', { remove_keyboard: true });
      await sendPayOffer(bot, { ...sub, phone }, chatId, supabase);
    }
    return new Response('ok');
  }

  if (msg?.text) {
    const chatId = String(msg.chat.id);
    const handle = msg.from?.username ? `@${msg.from.username}` : null;
    const text = msg.text.trim();

    if (/^\/stop\b/i.test(text)) {
      const { data: sub } = await supabase.from('digest_subscribers')
        .select('id, wfp_order_reference').eq('telegram_chat_id', chatId).maybeSingle();
      // Спершу зупиняємо списання, і лише потім статус: якщо WayForPay
      // недоступний, людина лишається активною і напише нам, а не виявить
      // за місяць, що гроші йдуть за послугу, якої вже немає.
      const cancelled = await cancelSubscription(sub);
      if (!cancelled.ok && cancelled.hadOrder) {
        await bot.sendMessage(chatId, '⚠️ Не вдалося автоматично скасувати списання. Напиши сюди — ми скасуємо вручну сьогодні ж, гроші не спишуться.');
        if (MAIN_TOKEN && ADMIN_CHAT_ID) {
          await makeBot(MAIN_TOKEN).sendMessage(ADMIN_CHAT_ID,
            `🚨 <b>WayForPay REMOVE не пройшов</b>\nchat <code>${chatId}</code>, order <code>${esc(sub?.wfp_order_reference || '—')}</code>\n${esc(cancelled.reason || cancelled.error || '')}`);
        }
        return new Response('ok');
      }
      await supabase.from('digest_subscribers')
        .update({ status: 'unsubscribed', plan: 'free', updated_at: new Date().toISOString() })
        .eq('telegram_chat_id', chatId);
      await bot.sendMessage(chatId, cancelled.hadOrder
        ? 'Відписано ✅ Списання скасовано — більше нічого не знімемо.\n\nПовернутись — /start'
        : 'Відписано ✅ Повернутись — /start');
      return new Response('ok');
    }

    if (/^\/start\b/i.test(text)) {
      let { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();

      // Deep-link із форми на сайті: /start <unsub_token>. Привʼязуємо чат до
      // вже створеного рядка, інакше нижче створився б дубль, а зібраний на
      // сайті профіль (вік, інтереси) загубився б.
      const startArg = text.match(/^\/start\s+(\S+)/i)?.[1];
      if (!sub && startArg) {
        const { data: linked } = await supabase.from('digest_subscribers')
          .update({ telegram_chat_id: chatId, telegram_handle: handle, updated_at: new Date().toISOString() })
          .eq('unsub_token', startArg).is('telegram_chat_id', null)
          .select('*').maybeSingle();
        if (linked) sub = linked;
      }

      if (!sub) {
        const { data: ins } = await supabase.from('digest_subscribers')
          .insert({ telegram_chat_id: chatId, channel: 'telegram', telegram_handle: handle, status: 'pending' })
          .select('*').single();
        sub = ins;
      }
      if (sub?.status === 'active') {
        if (!(sub.age_bands || []).length) await beginFlow(bot, supabase, chatId, handle); // ще без профілю → форма
        else await sendMainMenu(bot, chatId);                                              // є профіль → меню
      } else if (!sub?.phone) {
        await supabase.from('digest_subscribers').update({ flow_step: 'phone' }).eq('id', sub.id);
        await bot.sendMessage(chatId, '📱 Спершу поділись номером телефону — на нього надійде підтвердження оплати. Тисни кнопку нижче 👇', {
          keyboard: [[{ text: '📱 Поділитися номером', request_contact: true }]],
          resize_keyboard: true, one_time_keyboard: true,
        });
      } else {
        await sendPayOffer(bot, sub, chatId, supabase);        // телефон є → оплата
      }
      return new Response('ok');
    }

    if (/^\/(support|help|menu)\b/i.test(text)) {
      const { data: sub } = await supabase.from('digest_subscribers').select('status').eq('telegram_chat_id', chatId).maybeSingle();
      if (/^\/support\b/i.test(text)) {
        await bot.sendMessage(chatId, sub?.status === 'active'
          ? '📝 <b>Допомога із заявкою</b>\nНапишіть питання прямо сюди — підкажемо, що і як заповнювати.'
          : 'Допомога із заявкою доступна підписникам Dityam+. Оформити — /start 🧡');
      } else {
        await bot.sendMessage(chatId, '🧡 <b>Dityam+ — меню</b>\n\n/start — оформити або змінити профіль дитини\n/support — допомога із заявкою\n/stop — відписатися');
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
        await bot.sendMessage(chatId, '📝 Отримали. Відповімо тут найближчим часом 🧡');
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

  // Головне меню підписника.
  if ((cbq.data || '').startsWith('menu:')) {
    const chatId = String(cbq.message.chat.id);
    const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
    if (sub?.status !== 'active') { await bot.answerCallback(cbq.id, 'Оформи підписку — /start'); return new Response('ok'); }
    await bot.answerCallback(cbq.id);
    const action = (cbq.data || '').split(':')[1];
    if (action === 'form') await beginFlow(bot, supabase, chatId, null);
    else if (action === 'latest') await sendLatest(bot, supabase, sub, chatId);
    else if (action === 'sub') await bot.sendMessage(chatId, subDetails(sub));
    else if (action === 'support') await bot.sendMessage(chatId, '📝 Напишіть питання прямо сюди — підкажемо, що і як заповнювати.');
    return new Response('ok');
  }

  await bot.answerCallback(cbq.id);
  return new Response('ok');
}
