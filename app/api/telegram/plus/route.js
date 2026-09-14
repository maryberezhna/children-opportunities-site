// Вебхук окремого платного бота @DityamPlusBot.
//
// З 14.09.2026 порядок «спершу анкета, потім оплата»: /start → анкета про
// дітей → телефон → оплата. Раніше номер телефону просили першим кроком, ще
// до того, як людина побачила хоч якусь користь. Після оплати, якщо анкету
// вже пройдено, одразу меню, а не повторна анкета.
import { createClient } from '@supabase/supabase-js';
import {
  makeBot, beginFlow, beginAddChild, finishFlow, handleFlowCallback,
} from '@/lib/digestFlow';
import {
  createInvoice, wayforpayConfigured, removeRecurring, PRICE, PRICE_YEAR, PRICE_EARLY,
} from '@/lib/wayforpay';
import { matchThemes } from '@/lib/themes';
import {
  childrenOf, childLabel, matchFamily, pickFair, AGE_OPTIONS, LIKE_OPTIONS, FORMAT_OPTIONS,
  NEED_OPTIONS, PLACE_ONLINE, PLACE_ABROAD, PLACE_OTHER,
} from '@/lib/plusProfile';

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

export function GET() {
  // Діагностика: яку ціну/налаштування реально бачить жива функція на Vercel.
  return Response.json({ ok: true, price: PRICE, priceYear: PRICE_YEAR, priceEarly: PRICE_EARLY, wayforpay: wayforpayConfigured });
}

// Скасування підписки у WayForPay. hadOrder=false — платежу не було
// (людина так і не оплатила), тоді скасовувати нічого й це не помилка.
async function cancelSubscription(sub) {
  const ref = sub?.wfp_order_reference;
  if (!ref) return { ok: true, hadOrder: false };
  const r = await removeRecurring(ref);
  return { ...r, hadOrder: true };
}

// Живий доказ замість переліку обіцянок. Спершу те, що горить, потім
// добираємо вічнозеленими: у каталозі лише кілька десятків записів з
// відкритою подачею, а решта — довідкові (курси Prometheus, послуги easy.gov).
// Якби брали тільки дедлайнові, у пів року доказ був би порожній.
async function payoffProof(supabase) {
  const today = new Date().toISOString().slice(0, 10);
  const base = () => supabase.from('opportunities')
    .select('title, deadline')
    .eq('status', 'active').is('canonical_slug', null);

  const { data: urgent } = await base()
    .not('deadline', 'is', null).gte('deadline', today)
    .order('deadline', { ascending: true }).limit(2);

  const picked = [...(urgent || [])];
  if (picked.length < 2) {
    const { data: evergreen } = await base()
      .is('deadline', null)
      .order('created_at', { ascending: false }).limit(2 - picked.length);
    picked.push(...(evergreen || []));
  }
  if (!picked.length) return '';

  const M = ['січ','лют','бер','квіт','трав','черв','лип','сер','вер','жовт','лист','груд'];
  const lines = picked.map((o) => {
    const t = esc(o.title.slice(0, 60));
    if (!o.deadline) return `• ${t}`;
    const d = new Date(o.deadline);
    return `• ${t} — до ${d.getDate()} ${M[d.getMonth()]}`;
  });
  // Заголовок під фактичний склад: «горить» лише коли справді є дедлайни
  const head = picked.some((o) => o.deadline)
    ? 'Ось що зараз на платформі:'
    : 'Ось що є прямо зараз:';
  return `\n<b>${head}</b>\n${lines.join('\n')}\n`;
}

// Знижка для списку очікування (рішення Марії 14.09.2026): перший місяць за
// PRICE_EARLY. Лише тим, хто ще жодного разу не платив (немає
// wfp_order_reference), і лише якщо людина є в plus_waitlist — за chat_id
// (записалась через @DityamComUABot; у приватному чаті chat_id однаковий для
// обох ботів, бо це id користувача), за посиланням w_<id> з листа про запуск
// (воно дописує chat_id у рядок списку) або за імейлом.
async function isEarlyBird(supabase, sub) {
  if (!supabase || !sub || sub.wfp_order_reference) return false;
  const inList = async (col, val) => {
    const { count } = await supabase.from('plus_waitlist')
      .select('id', { count: 'exact', head: true }).eq(col, val);
    return (count || 0) > 0;
  };
  if (sub.telegram_chat_id && await inList('telegram_chat_id', String(sub.telegram_chat_id))) return true;
  return Boolean(sub.email) && inList('email', String(sub.email).toLowerCase());
}

async function sendPayOffer(bot, sub, chatId, supabase) {
  // «Ви» — як на сайті. Раніше тут було «ти», і людина бачила два різні
  // тони в одному продукті.
  //
  // Свідомо НЕ обіцяємо «подарунки від партнерів»: у коді такого немає,
  // а обіцянка, яку нічим не закрити, коштує дорожче за зайвий рядок.
  const proof = supabase ? await payoffProof(supabase) : '';
  const text = '🧡 <b>Dityam+</b>\n\n'
    // До 14.09.2026 тут стояло «памʼятаємо, куди дитина вже подавалась, і
    // пропонуємо наступний крок» — у коді такого немає, тезу прибрано.
    + 'Платформа показує все, що існує. Dityam+ щодня добирає з цього те, що підходить '
    + 'кожній вашій дитині, і нагадує про дедлайни, поки ще є час подати заявку.\n'
    + proof
    + '\n<b>Що входить:</b>\n'
    + '• Відбір під кожну дитину: вік, вподобання, формат і місто\n'
    + '• Нагадування про дедлайни завчасно — за 2–4 тижні для стипендій і обмінів\n'
    + '• Допомога із заявкою — напишіть сюди, підкажемо, що заповнювати\n'
    + '• Свіжі можливості на вимогу — будь-коли, одним дотиком у меню\n'
    + '• Усе приходить сюди, у Telegram';
  if (wayforpayConfigured && sub) {
    const early = await isEarlyBird(supabase, sub);
    const [m, y] = await Promise.all([createInvoice(sub, 'monthly', { early }), createInvoice(sub, 'yearly')]);
    const rows = [];
    if (m.url) {
      rows.push([{
        text: early ? `Перший місяць за ${PRICE_EARLY} грн, далі ${PRICE} грн/міс` : `Оформити за ${PRICE} грн/міс`,
        url: m.url,
      }]);
    }
    if (y.url) rows.push([{ text: `Рік за ${PRICE_YEAR} грн — вигідніше`, url: y.url }]);
    const offer = early
      ? `${text}\n\n🎁 <b>Ви були в списку очікування</b> — як обіцяли, перший місяць за ${PRICE_EARLY} грн замість ${PRICE}.`
      : text;
    if (rows.length) { await bot.sendMessage(chatId, offer, { inline_keyboard: rows }); return; }
  }
  await bot.sendMessage(chatId, `${text}\n\n⏳ Оплата підключається — зовсім скоро.`);
}

// Головне меню для активного підписника.
async function sendMainMenu(bot, chatId) {
  await bot.sendMessage(chatId, 'Вітаю! 🧡 Ви підписник <b>Dityam+</b>.\nЩо зробимо?', {
    inline_keyboard: [
      [{ text: '🔎 Останні можливості для дітей', callback_data: 'menu:latest' }],
      [{ text: '➕ Додати дитину', callback_data: 'menu:addchild' }],
      [{ text: '✏️ Заповнити анкету заново', callback_data: 'menu:form' }],
      [{ text: '📬 Куди надсилати', callback_data: 'menu:channel' }],
      [{ text: '⭐ Деталі підписки', callback_data: 'menu:sub' }],
      [{ text: '📝 Питання в підтримку', callback_data: 'menu:support' }],
    ],
  });
}

async function loadKids(supabase, sub) {
  const { data } = await supabase.from('plus_children').select('*').eq('subscriber_id', sub.id);
  return childrenOf(sub, data || []);
}

async function hasProfile(supabase, sub) {
  const { count } = await supabase.from('plus_children')
    .select('id', { count: 'exact', head: true }).eq('subscriber_id', sub.id);
  return (count || 0) > 0 || (sub.age_bands || []).length > 0;
}

// Останні можливості під профіль дітей (на вимогу, топ-5). Якщо дітей кілька,
// місця діляться по черзі, а біля кожної можливості видно, кому вона.
async function sendLatest(bot, supabase, sub, chatId) {
  const { data: opps } = await supabase.from('opportunities')
    .select('title, slug, age_from, age_to, cost_type, summary, created_at, opportunity_type, format, cities, countries, is_international, child_needs')
    .eq('status', 'active').is('canonical_slug', null)
    .order('created_at', { ascending: false }).limit(300);
  const kids = await loadKids(supabase, sub);
  const themesOf = (o) => new Set(matchThemes(`${o.title} ${o.summary || ''}`));
  const picked = pickFair(matchFamily(sub, kids, opps || [], themesOf), kids, 5);
  if (!picked.length) {
    await bot.sendMessage(chatId, 'Поки немає нічого під профіль — щойно зʼявиться, напишемо першими. Можна розширити вподобання чи місто через «✏️ Заповнити анкету заново».');
    return;
  }
  const lines = [kids.length > 1 ? '🔎 <b>Останні можливості для ваших дітей</b>' : '🔎 <b>Останні можливості під вашу дитину</b>', ''];
  for (const m of picked) {
    lines.push(`🔸 <a href="${SITE_URL}/o/${m.o.slug}">${esc(m.o.title)}</a>`);
    if (kids.length > 1) lines.push(`<i>для: ${esc(m.kids.map((k) => childLabel(k, kids.length)).join(', '))}</i>`);
  }
  await bot.sendMessage(chatId, lines.join('\n'));
}

async function askPhone(bot, supabase, sub, chatId) {
  await supabase.from('digest_subscribers').update({ flow_step: 'phone' }).eq('id', sub.id);
  await bot.sendMessage(chatId, '📱 Поділіться номером телефону — на нього надійде підтвердження оплати. Натисніть кнопку нижче 👇', {
    keyboard: [[{ text: '📱 Поділитися номером', request_contact: true }]],
    resize_keyboard: true, one_time_keyboard: true,
  });
}

async function askConsent(bot, chatId) {
  await bot.sendMessage(chatId,
    '🧡 <b>Вітаємо в Dityam+</b>\n\n'
    + 'Далі кілька питань про дитину: вік, вподобання, формат і, за бажанням, особливі обставини. '
    + 'Відповіді потрібні лише для того, щоб добирати можливості.\n\n'
    + `Натискаючи «Погоджуюсь», ви приймаєте <a href="${SITE_URL}/terms">Публічну оферту</a> `
    + `і даєте згоду на обробку даних згідно з <a href="${SITE_URL}/privacy">Політикою конфіденційності</a>.`,
    { inline_keyboard: [[{ text: '✅ Погоджуюсь', callback_data: 'consent:yes' }]] });
}

// Куди вести людину після /start або після згоди. Згода — до першого питання
// про дитину: анкета збирає й чутливі дані (інвалідність, онкозахворювання,
// сирітство). До 14.09.2026 згоду фіксували лише наприкінці анкети або при
// оплаті, а оферту й політику конфіденційності бот не показував узагалі.
async function continueStart(bot, supabase, sub, chatId, handle) {
  if (!sub) return;
  if (!sub.consent_at) { await askConsent(bot, chatId); return; }
  const profiled = await hasProfile(supabase, sub);
  if (!profiled) await beginFlow(bot, supabase, chatId, handle);        // спершу анкета
  else if (sub.status === 'active') await sendMainMenu(bot, chatId);  // є профіль і підписка → меню
  else if (!sub.phone) await askPhone(bot, supabase, sub, chatId);    // анкета є → телефон
  else await sendPayOffer(bot, sub, chatId, supabase);                // телефон є → оплата
}

// Куди надсилати можливості й нагадування. До 14.09.2026 бот завжди ставив
// channel='telegram', хоча personal_digest і deadline_reminders уміють слати
// листом, а /plus обіцяє «у Telegram або на імейл».
async function askChannel(bot, chatId) {
  await bot.sendMessage(chatId, '📬 <b>Куди надсилати можливості й нагадування?</b>\nОплата, меню й допомога в будь-якому разі лишаються тут, у боті.', {
    inline_keyboard: [
      [{ text: '✈️ Сюди, у Telegram', callback_data: 'chan:telegram' }],
      [{ text: '📧 На імейл', callback_data: 'chan:email' }],
    ],
  });
}

// Після вибору каналу: підписника повертаємо в меню, решту — до телефону й оплати.
async function afterChannel(bot, supabase, sub, chatId) {
  if (sub.status === 'active') { await bot.sendMessage(chatId, 'Готово ✅ Меню — /start'); return; }
  if (!sub.phone) await askPhone(bot, supabase, sub, chatId);
  else await sendPayOffer(bot, sub, chatId, supabase);
}

const labels =(options, values) => (values || [])
  .map((v) => (options.find((o) => o[0] === v) || [null, v])[1]).join(', ') || '—';
const PLACE_LABELS = [[PLACE_ONLINE, 'онлайн'], [PLACE_ABROAD, 'за кордоном'], [PLACE_OTHER, 'мого міста немає']];

function subDetails(sub, kids) {
  const lines = ['⭐ <b>Ваша підписка Dityam+</b>', 'Статус: активна ✅', ''];
  kids.forEach((k, i) => {
    lines.push(`<b>${kids.length > 1 ? esc(childLabel(k, kids.length)) : 'Дитина'}</b>`);
    lines.push(`Вік: ${esc(labels(AGE_OPTIONS, k.age_bands))}`);
    lines.push(`Подобається: ${esc(labels(LIKE_OPTIONS, k.likes))}`);
    lines.push(`Формат: ${esc(labels(FORMAT_OPTIONS, k.formats))}`);
    if ((k.needs || []).length) lines.push(`Обставини: ${esc(labels(NEED_OPTIONS, k.needs))}`);
    if (i < kids.length - 1) lines.push('');
  });
  lines.push('', `Де: ${esc(labels(PLACE_LABELS, sub.places))}`);
  lines.push(`Вартість: ${sub.cost_pref === 'free_only' ? 'лише безкоштовні' : 'будь-які'}`);
  lines.push(`Куди надсилаємо: ${sub.channel === 'email' && sub.email ? `імейл ${esc(sub.email)}` : 'Telegram'}`);
  lines.push('', 'Додати дитину чи змінити відповіді — у меню /start. Скасувати підписку — /stop.');
  return lines.join('\n');
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
        await bot.sendMessage(chatId, '⚠️ Не вдалося автоматично скасувати списання. Напишіть сюди — ми скасуємо вручну сьогодні ж, гроші не спишуться.');
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

      // Посилання з листа про запуск: /start w_<id рядка plus_waitlist>. Людина
      // записалась у список імейлом, тож її chat_id там порожній. Привʼязуємо
      // чат до запису — за ним бот дає знижку для перших (isEarlyBird).
      if (startArg?.startsWith('w_')) {
        await supabase.from('plus_waitlist')
          .update({ telegram_chat_id: chatId, telegram_username: handle })
          .eq('id', startArg.slice(2)).is('telegram_chat_id', null);
      }

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
      await continueStart(bot, supabase, sub, chatId, handle);
      return new Response('ok');
    }

    if (/^\/(support|help|menu)\b/i.test(text)) {
      const { data: sub } = await supabase.from('digest_subscribers').select('status').eq('telegram_chat_id', chatId).maybeSingle();
      if (/^\/support\b/i.test(text)) {
        await bot.sendMessage(chatId, sub?.status === 'active'
          ? '📝 <b>Допомога із заявкою</b>\nНапишіть питання прямо сюди — підкажемо, що і як заповнювати.'
          : 'Допомога із заявкою доступна підписникам Dityam+. Оформити — /start 🧡');
      } else {
        await bot.sendMessage(chatId, '🧡 <b>Dityam+ — меню</b>\n\n/start — оформити підписку або змінити профіль дітей\n/support — допомога із заявкою\n/stop — відписатися');
      }
      return new Response('ok');
    }

    if (!text.startsWith('/')) {
      const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();

      // Після «📧 На імейл» наступне повідомлення — адреса.
      if (sub?.flow_step === 'email') {
        const email = text.toLowerCase();
        if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          await bot.sendMessage(chatId, 'Здається, в адресі одрук. Напишіть імейл ще раз, наприклад name@gmail.com.');
          return new Response('ok');
        }
        const { error } = await supabase.from('digest_subscribers')
          .update({ email, channel: 'email', flow_step: null, updated_at: new Date().toISOString() })
          .eq('id', sub.id);
        if (error) {
          await bot.sendMessage(chatId, 'Не вдалося зберегти цей імейл — можливо, він уже привʼязаний до іншої підписки. Спробуйте інший або напишіть на hellodityam.com.ua@gmail.com.');
          return new Response('ok');
        }
        await bot.sendMessage(chatId, `✅ Надсилатимемо можливості й нагадування на <b>${esc(email)}</b>.`);
        await afterChannel(bot, supabase, { ...sub, email, channel: 'email' }, chatId);
        return new Response('ok');
      }

      // Підтримка у поданні: будь-який інший текст від активного підписника → адміну.
      if (sub?.status === 'active') {
        if (MAIN_TOKEN && ADMIN_CHAT_ID) {
          await makeBot(MAIN_TOKEN).sendMessage(ADMIN_CHAT_ID, `📝 <b>Питання підписника Dityam+</b> ${esc(sub.telegram_handle || '')} <code>${chatId}</code>:\n\n${esc(text.slice(0, 700))}\n\n<i>↩️ Відповідайте реплаєм на це повідомлення — відповідь піде підписнику від @DityamPlusBot.</i>`);
        }
        await bot.sendMessage(chatId, '📝 Отримали. Відповімо тут найближчим часом 🧡');
      }
    }
    return new Response('ok');
  }

  const cbq = update?.callback_query;
  if (!cbq) return new Response('ok');

  // «✅ Погоджуюсь» — фіксуємо згоду й ведемо далі тим самим шляхом, що /start.
  if (cbq.data === 'consent:yes') {
    const chatId = String(cbq.message.chat.id);
    await bot.answerCallback(cbq.id);
    const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
    if (!sub) { await bot.sendMessage(chatId, 'Почніть з /start'); return new Response('ok'); }
    const consentAt = sub.consent_at || new Date().toISOString();
    if (!sub.consent_at) {
      await supabase.from('digest_subscribers').update({ consent_at: consentAt, updated_at: consentAt }).eq('id', sub.id);
    }
    await bot.editMessage(chatId, cbq.message.message_id, '✅ Оферту й політику конфіденційності прийнято.');
    await continueStart(bot, supabase, { ...sub, consent_at: consentAt }, chatId, null);
    return new Response('ok');
  }

  // «Куди надсилати»: Telegram одразу веде далі, імейл — чекає адресу текстом.
  if ((cbq.data || '').startsWith('chan:')) {
    const chatId = String(cbq.message.chat.id);
    await bot.answerCallback(cbq.id);
    const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
    if (!sub) { await bot.sendMessage(chatId, 'Почніть з /start'); return new Response('ok'); }
    const now = new Date().toISOString();
    if (cbq.data === 'chan:email') {
      await supabase.from('digest_subscribers').update({ flow_step: 'email', updated_at: now }).eq('id', sub.id);
      await bot.editMessage(chatId, cbq.message.message_id, '📬 Куди надсилати: <b>на імейл</b>');
      await bot.sendMessage(chatId, '📧 Напишіть адресу імейлу одним повідомленням.');
    } else {
      await supabase.from('digest_subscribers').update({ channel: 'telegram', flow_step: null, updated_at: now }).eq('id', sub.id);
      await bot.editMessage(chatId, cbq.message.message_id, '📬 Куди надсилати: <b>сюди, у Telegram</b> ✅');
      await afterChannel(bot, supabase, { ...sub, channel: 'telegram' }, chatId);
    }
    return new Response('ok');
  }

  // Анкету тепер проходять і до оплати, тож статус тут не перевіряємо.
  // Що далі після останнього питання — вирішуємо за статусом.
  if ((cbq.data || '').startsWith('flow:')) {
    const chatId = String(cbq.message.chat.id);
    const { finished } = await handleFlowCallback(bot, supabase, cbq);
    if (finished) {
      const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
      if (sub?.status === 'active') {
        await finishFlow(bot, chatId, { active: true });
      } else if (sub) {
        await finishFlow(bot, chatId, { active: false });
        await askChannel(bot, chatId);                 // далі телефон і оплата — у afterChannel
      }
    }
    return new Response('ok');
  }

  // Головне меню підписника.
  if ((cbq.data || '').startsWith('menu:')) {
    const chatId = String(cbq.message.chat.id);
    const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
    if (sub?.status !== 'active') { await bot.answerCallback(cbq.id, 'Оформіть підписку — /start'); return new Response('ok'); }
    await bot.answerCallback(cbq.id);
    const action = (cbq.data || '').split(':')[1];
    if (action === 'form') await beginFlow(bot, supabase, chatId, null);
    else if (action === 'addchild') await beginAddChild(bot, supabase, chatId);
    else if (action === 'latest') await sendLatest(bot, supabase, sub, chatId);
    else if (action === 'sub') await bot.sendMessage(chatId, subDetails(sub, await loadKids(supabase, sub)));
    else if (action === 'channel') await askChannel(bot, chatId);
    else if (action === 'support') await bot.sendMessage(chatId, '📝 Напишіть питання прямо сюди — підкажемо, що і як заповнювати.');
    return new Response('ok');
  }

  await bot.answerCallback(cbq.id);
  return new Response('ok');
}
