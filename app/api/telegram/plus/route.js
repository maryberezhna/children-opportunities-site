// Вебхук окремого платного бота @DityamPlusBot.
//
// З 14.09.2026 порядок «спершу анкета, потім оплата»: /start → анкета про
// дітей → телефон → оплата. Раніше номер телефону просили першим кроком, ще
// до того, як людина побачила хоч якусь користь. Після оплати, якщо анкету
// вже пройдено, одразу меню, а не повторна анкета.
import { createClient } from '@supabase/supabase-js';
import {
  makeBot, beginFlow, beginAddChild, finishFlow, handleFlowCallback, saveCustomCity,
} from '@/lib/digestFlow';
import {
  createInvoice, wayforpayConfigured, removeRecurring, PRICE, PRICE_YEAR,
} from '@/lib/wayforpay';
import { matchThemes } from '@/lib/themes';
import { findPromo, promoUsable, claimPromo, parseStartArg, normalizeCode } from '@/lib/promo';
import { cutTitle } from '@/lib/text';
import {
  childrenOf, childLabel, matchFamily, pickFair, AGE_OPTIONS, LIKE_OPTIONS, FORMAT_OPTIONS,
  NEED_OPTIONS, PLACE_ONLINE, PLACE_ABROAD, PLACE_OTHER,
} from '@/lib/plusProfile';
import { PLUS_SALES_OPEN } from '@/lib/plus';

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
    const t = esc(cutTitle(o.title, 60));
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
    // Єдина підстава для знижки — промокод (рішення Марії 19.09.2026).
    // Раніше бот сам давав перший місяць за 1 грн тому, кого знаходив у
    // plus_waitlist за chat_id. Механіка мовчки обходила трьох людей, що
    // лишили пошту, і обіцяла знижку тим, хто про неї не просив. Тепер
    // список очікування отримує код FIRST у листі про запуск — і знижка
    // в усіх одна.
    const promo = sub.promo_code ? await findPromo(supabase, sub.promo_code) : null;
    const promoOk = promo && promoUsable(promo, { used: promo.used }).ok && !sub.wfp_order_reference;
    const firstMonth = promoOk ? Number(promo.first_amount) : null;
    const firstYear = promoOk && promo.yearly_amount != null ? Number(promo.yearly_amount) : null;
    const [m, y] = await Promise.all([
      createInvoice(sub, 'monthly', { firstAmount: firstMonth }),
      createInvoice(sub, 'yearly', { firstAmount: firstYear }),
    ]);
    const rows = [];
    if (m.url) {
      const monthText = firstMonth != null
        ? `Перший місяць за ${fmtPrice(firstMonth)} грн, далі ${PRICE} грн/міс`
        : `Оформити за ${PRICE} грн/міс`;
      rows.push([{ text: monthText, url: m.url }]);
    }
    if (y.url) {
      rows.push([{
        text: firstYear != null ? `Перший рік за ${fmtPrice(firstYear)} грн замість ${PRICE_YEAR}`
          : `Рік за ${PRICE_YEAR} грн — вигідніше`,
        url: y.url,
      }]);
    }
    // Кнопку «У мене є промокод» показуємо, поки коду немає: інакше людина
    // не здогадається, що код узагалі можна ввести, і введе його в чат
    // навмання (або не введе зовсім).
    // Емодзі лишається ЛИШЕ на кнопці: там Telegram малює його як треба,
    // а в тексті повідомлення те саме 🎟 приїхало як \uD83C\uDF9F (Марія, 19.09.2026).
    if (!promoOk) rows.push([{ text: '🎟 У мене є промокод', callback_data: 'promo:ask' }]);
    // Підказка в тексті, а не лише кнопка: людина з кодом у руках мусить
    // одразу бачити, що його є де ввести (Марія, 19.09.2026).
    const promoHint = '\n\n<b>Є промокод?</b> Натисніть «У мене є промокод» — і введіть його у віконечку, '
      + 'що зʼявиться. Ціна на кнопці одразу оновиться.';
    const offer = promoOk
      ? `${text}\n\n<b>Промокод ${esc(String(sub.promo_code).toUpperCase())} застосовано</b> — `
        + `перший місяць за ${fmtPrice(firstMonth)} грн замість ${PRICE}`
        + (firstYear != null ? `, перший рік за ${fmtPrice(firstYear)} замість ${PRICE_YEAR}` : '')
        + '. Далі — звичайна ціна.'
      : `${text}${promoHint}`;
    if (rows.length) { await bot.sendMessage(chatId, offer, { inline_keyboard: rows }); return; }
  }
  await bot.sendMessage(chatId, `${text}\n\n⏳ Оплата підключається — зовсім скоро.`);
}

// Команди підписника в меню «/» (їхній перелік реєструє
// scripts/set-bot-commands.mjs — тримати списки однаковими).
const SUB_COMMANDS = new Set(['new', 'child', 'form', 'profile']);

const COMMANDS_TEXT = '🧡 <b>Dityam+ — команди</b>\n\n'
  + '/start — головне меню\n'
  + '/new — свіжі можливості під профіль дитини\n'
  + '/child — додати ще одну дитину\n'
  + '/form — заповнити анкету заново\n'
  + '/profile — профіль дітей і деталі підписки\n'
  + '/support — допомога із заявкою\n'
  + '/stop — відписатися і скасувати списання';

// Головне меню для активного підписника.
async function sendMainMenu(bot, chatId) {
  await bot.sendMessage(chatId, 'Вітаю! 🧡 Ви підписник <b>Dityam+</b>.\nЩо зробимо?', {
    inline_keyboard: [
      [{ text: '🔎 Останні можливості для дітей', callback_data: 'menu:latest' }],
      [{ text: '➕ Додати дитину', callback_data: 'menu:addchild' }],
      [{ text: '✏️ Заповнити анкету заново', callback_data: 'menu:form' }],
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

// Після анкети: підписника повертаємо в меню, решту — до телефону й оплати.
// Можливості й нагадування йдуть лише сюди, у Telegram: питання «Куди
// надсилати» з варіантом «На імейл» прибрано 15.09.2026 (рішення Марії).
async function afterProfile(bot, supabase, sub, chatId) {
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
  lines.push('', 'Додати дитину чи змінити відповіді — у меню /start. Скасувати підписку — /stop.');
  return lines.join('\n');
}

// Список очікування Dityam+ — у цьому боті, а не в основному (15.09.2026):
// основний бот зветься «Dityam Адмінка 🛠», і людина, що хотіла дізнатись про
// Dityam+, отримувала відповідь від «адмінки». source = 'plus_bot:<звідки>' —
// за ним plus_launch.py знає, яким ботом писати про запуск.
const fmtPrice = (n) => Number(n).toLocaleString('uk-UA');
const WAITLIST_WELCOME = () => `Ви в списку перших! 🧡

Dityam+ — платна підписка: ${fmtPrice(PRICE)} грн/міс або ${fmtPrice(PRICE_YEAR)} грн/рік. Щодня добираємо можливості окремо для кожної вашої дитини — за віком, вподобаннями й містом. Плюс нагадування про дедлайни завчасно: за 2–4 тижні для стипендій, грантів і обмінів, за тиждень — для курсів і гуртків.

Щойно запустимось — напишемо вам сюди першим, зі знижкою для перших. А платформа Dityam.com.ua лишається безкоштовною для всіх.`;

async function joinWaitlist(bot, supabase, chatId, handle, startArg) {
  const from = String(startArg).replace(/^waitlist_?/i, '') || 'site';
  const { data: existing } = await supabase.from('plus_waitlist')
    .select('id').eq('telegram_chat_id', chatId).maybeSingle();
  if (existing) {
    await bot.sendMessage(chatId, 'Ви вже в списку перших 🧡 Щойно Dityam+ запуститься — напишемо вам сюди.');
    return;
  }
  await supabase.from('plus_waitlist').insert({
    telegram_chat_id: chatId,
    telegram_username: handle,
    source: `plus_bot:${from}`,
  });
  // Сповіщення адміну — з основного бота, у ваш адмінський чат; людина його не бачить.
  if (MAIN_TOKEN && ADMIN_CHAT_ID) {
    await makeBot(MAIN_TOKEN).sendMessage(ADMIN_CHAT_ID,
      `🚀 <b>Dityam+ — новий у списку очікування</b>\n${esc(handle || chatId)} · через бот Dityam+ · ${esc(from)}`);
  }
  await bot.sendMessage(chatId, WAITLIST_WELCOME());
}

// Промокод: перевіряємо, запамʼятовуємо на підписнику й ведемо людину далі
// звичайним шляхом — знижку вона побачить на кнопці оплати. Про кожне
// введення пишемо в адмін-чат: інакше незрозуміло, скільки людей код привів.
async function applyPromo(bot, supabase, { chatId, handle, code, source }) {
  const c = normalizeCode(code);
  if (!c) return false;
  const promo = await findPromo(supabase, c);
  const check = promoUsable(promo, { used: promo?.used || 0 });
  if (!check.ok) {
    if (check.reason === 'unknown') return false;   // не код — мовчимо, це міг бути просто текст
    await bot.sendMessage(chatId, check.reason === 'expired'
      ? 'Термін дії цього промокоду минув 🙈 Але підписка доступна за звичайною ціною — /start'
      : 'Цей промокод уже розібрали 🙈 Підписка доступна за звичайною ціною — /start');
    return true;
  }

  let { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
  if (sub?.status === 'active') {
    await bot.sendMessage(chatId, 'У вас уже активна підписка 🧡 Промокод діє лише на перший платіж.');
    return true;
  }
  if (!sub) {
    const { data: ins } = await supabase.from('digest_subscribers')
      .insert({ telegram_chat_id: chatId, channel: 'telegram', telegram_handle: handle, status: 'pending', promo_code: c })
      .select('*').single();
    sub = ins;
  } else {
    const { data: upd } = await supabase.from('digest_subscribers')
      .update({ promo_code: c, telegram_handle: handle || sub.telegram_handle, updated_at: new Date().toISOString() })
      .eq('id', sub.id).select('*').maybeSingle();
    sub = upd || { ...sub, promo_code: c };
  }
  await claimPromo(supabase, { code: c, chatId, handle, source });
  if (MAIN_TOKEN && ADMIN_CHAT_ID) {
    await makeBot(MAIN_TOKEN).sendMessage(ADMIN_CHAT_ID,
      `<b>Промокод ${esc(c.toUpperCase())}</b> ввів ${esc(handle || chatId)} · ${esc(source || 'typed')}`);
  }
  await bot.sendMessage(chatId, `Промокод <b>${esc(c.toUpperCase())}</b> прийнято — знижку побачите на кнопці оплати.`);
  await continueStart(bot, supabase, sub, chatId, handle);
  return true;
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
      const startArg = text.match(/^\/start\s+(\S+)/i)?.[1];

      // Діп-лінк із промокодом: ?start=promo_first[_звідки]. Джерело — щоб
      // було видно, який пост чи канал привів людину.
      const fromLink = parseStartArg(startArg);
      if (fromLink
          && await applyPromo(bot, supabase, { chatId, handle, code: fromLink.code, source: fromLink.source })) {
        return new Response('ok');
      }

      // Кнопки «Хочу першим» на сайті й у каналі: ?start=waitlist[_звідки].
      // Поки продаж закритий, людина лише стає в список — без анкети, оплати й
      // рядка в digest_subscribers. Коли продаж відкрито, та сама кнопка веде
      // далі звичайним шляхом /start.
      if (!PLUS_SALES_OPEN && /^waitlist/i.test(startArg || '')) {
        await joinWaitlist(bot, supabase, chatId, handle, startArg);
        return new Response('ok');
      }

      let { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();

      // Deep-link із форми на сайті: /start <unsub_token>. Привʼязуємо чат до
      // вже створеного рядка, інакше нижче створився б дубль, а зібраний на
      // сайті профіль (вік, інтереси) загубився б.

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
        await bot.sendMessage(chatId, COMMANDS_TEXT);
      }
      return new Response('ok');
    }

    // Команди підписника — те саме, що кнопки головного меню, але з меню «/»
    // Telegram: людина бачить перелік і не мусить памʼятати, де яка кнопка.
    const cmd = text.match(/^\/([a-z]+)\b/i)?.[1]?.toLowerCase();
    if (cmd && SUB_COMMANDS.has(cmd)) {
      const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
      if (sub?.status !== 'active') {
        await bot.sendMessage(chatId, 'Це для підписників Dityam+. Оформити підписку — /start 🧡');
        return new Response('ok');
      }
      if (cmd === 'new') await sendLatest(bot, supabase, sub, chatId);
      else if (cmd === 'child') await beginAddChild(bot, supabase, chatId);
      else if (cmd === 'form') await beginFlow(bot, supabase, chatId, handle);
      else await bot.sendMessage(chatId, subDetails(sub, await loadKids(supabase, sub)));
      return new Response('ok');
    }

    if (!text.startsWith('/')) {
      const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();

      // Текст на кроці «Де» — це місто, якого немає серед кнопок. Перевірка
      // стоїть перед підтримкою: інакше місто від підписника, який заповнює
      // анкету заново, пішло б адміну як питання. І перед промокодом: людина
      // посеред анкети вводить місто, а не код.
      if (sub?.flow_step === 'place') {
        await saveCustomCity(bot, supabase, chatId, sub, text);
        return new Response('ok');
      }

      // Промокод, введений руками: одне слово від того, хто ще не платить.
      // Теж до звернення в підтримку, інакше «first» полетів би адміну як
      // питання.
      if (sub?.status !== 'active' && normalizeCode(text)
          && await applyPromo(bot, supabase, { chatId, handle, code: text, source: 'typed' })) {
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

  // «🎟 У мене є промокод» — просимо ввести його одним словом. Стан не
  // зберігаємо: будь-яке наступне слово від неплатника і так перевіряється
  // як код.
  if (cbq.data === 'promo:ask') {
    await bot.answerCallback(cbq.id);
    // force_reply відкриває людині поле введення — те саме «віконечко»,
    // якого вона чекає, замість здогадки «а куди писати?».
    // У підказці поля НЕ пишемо справжній код: її бачить кожен, хто натисне
    // кнопку, і код дістався б тим, кому ми його не давали (Марія, 19.09.2026).
    await bot.sendMessage(String(cbq.message.chat.id),
      'Введіть промокод у віконечку нижче — великими чи малими літерами, це не важливо.',
      { force_reply: true, input_field_placeholder: 'Ваш промокод' });
    return new Response('ok');
  }

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

  // Кнопки «Куди надсилати» (chan:) лишились у старих повідомленнях: до
  // 15.09.2026 бот питав, слати в Telegram чи на імейл. Імейл прибрано, тож
  // будь-яка з них просто веде далі, а доставка — лише в Telegram.
  if ((cbq.data || '').startsWith('chan:')) {
    const chatId = String(cbq.message.chat.id);
    await bot.answerCallback(cbq.id);
    const { data: sub } = await supabase.from('digest_subscribers').select('*').eq('telegram_chat_id', chatId).maybeSingle();
    if (!sub) { await bot.sendMessage(chatId, 'Почніть з /start'); return new Response('ok'); }
    await supabase.from('digest_subscribers')
      .update({ channel: 'telegram', flow_step: null, updated_at: new Date().toISOString() }).eq('id', sub.id);
    await bot.editMessage(chatId, cbq.message.message_id, '📬 Можливості й нагадування надсилаємо сюди, у Telegram ✅');
    await afterProfile(bot, supabase, { ...sub, channel: 'telegram' }, chatId);
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
        await afterProfile(bot, supabase, sub, chatId); // далі телефон і оплата
      }
    }
    return new Response('ok');
  }

  // «👍 / 👎» під добіркою Dityam+ (personal_digest.telegram_keyboard):
  // opportunity_feedback за Telegram-id. «👎» — цю можливість підписнику більше
  // не надсилаємо.
  const pfb = (cbq.data || '').match(/^pfb:(yes|no):([0-9a-f-]{36})$/i);
  if (pfb) {
    const userId = cbq.from?.id;
    if (!userId) { await bot.answerCallback(cbq.id); return new Response('ok'); }
    const { error } = await supabase.from('opportunity_feedback').upsert({
      opportunity_id: pfb[2],
      telegram_user_id: userId,
      value: pfb[1],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'opportunity_id,telegram_user_id' });
    await bot.answerCallback(cbq.id, error
      ? 'Не вдалося зберегти, спробуйте ще раз'
      : pfb[1] === 'yes' ? 'Позначили: цікаво 👍' : 'Позначили: не цікаво — більше не надсилатимемо');
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
    else if (action === 'support') await bot.sendMessage(chatId, '📝 Напишіть питання прямо сюди — підкажемо, що і як заповнювати.');
    return new Response('ok');
  }

  await bot.answerCallback(cbq.id);
  return new Response('ok');
}
