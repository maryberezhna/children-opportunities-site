import { createClient } from '@supabase/supabase-js';
import { pushModeration } from '@/lib/notion';
import { missingRequired } from '@/lib/required';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-KPLE8LGH91';
const GA4_API_SECRET = process.env.GA4_API_SECRET;

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const SITE_URL = process.env.SITE_URL || 'https://dityam.com.ua';

// Admin gate — fails CLOSED: without TELEGRAM_ADMIN_CHAT_ID nobody is an admin.
// A missing env var must lock moderation down, not open it to every bot user.
// The chat id also counts (identical to the user id in a private chat).
function isAdmin(fromId, chatId) {
  if (!ADMIN_CHAT_ID) return false;
  return String(fromId) === String(ADMIN_CHAT_ID) || String(chatId) === String(ADMIN_CHAT_ID);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function editMessage(chatId, messageId, text) {
  await fetch(`${TG}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, message_id: messageId, text,
      parse_mode: 'HTML', disable_web_page_preview: true,
    }),
  }).catch(() => {});
}

const MOD_TYPE_LABELS = {
  course: 'Курс', workshop: 'Майстер-клас', summer_school: 'Літня школа',
  study_program: 'Навчальна програма', club: 'Гурток', camp: 'Табір',
  olympiad: 'Олімпіада', competition: 'Конкурс', hackathon: 'Хакатон',
  festival: 'Фестиваль', exchange: 'Обмін', scholarship: 'Стипендія',
  grant: 'Грант', allowance: 'Виплата', internship: 'Стажування',
  volunteer: 'Волонтерство', mentorship: 'Менторство',
};

async function sendMessage(chatId, text, replyMarkup) {
  await fetch(`${TG}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  }).catch(() => {});
}

function candidateText(o, remaining) {
  const meta = [`📚 ${MOD_TYPE_LABELS[o.opportunity_type] || o.opportunity_type}`];
  if (o.age_from != null && o.age_to != null) meta.push(`👶 ${o.age_from}–${o.age_to} р.`);
  if (o.cost_type === 'free') meta.push('✅ безкоштовно');
  const head = `🆕 <b>Кандидат на апрув</b>${remaining ? ` · ще ${remaining} у черзі` : ''}`;
  const lines = [head, '', `🎓 <b>${escapeHtml(o.title)}</b>`, meta.join(' · ')];
  // Дата або періодичність — завжди видимі: картка без жодної позначки
  // не дає зрозуміти, живий запис чи торішній.
  if (o.deadline) lines.push(`⏰ Дедлайн: ${o.deadline}`);
  else if (o.event_end_date) lines.push(`⏰ Завершення: ${o.event_end_date}`);
  else if (o.recurrence === 'annual') lines.push('🔁 Щорічна');
  else if (o.recurrence === 'ongoing') lines.push('♾ Постійно відкрита');
  // Обовʼязковий мінімум перед сайтом: дата, тип, вік, вартість і
  // місце-або-формат (вимога Марії 11.09.2026). Показуємо перелік ДО тапу,
  // щоб кнопка «Додати» не відмовляла несподівано.
  const missing = missingRequired(o);
  if (missing.length) {
    lines.push(`⛔ Не піде на сайт — бракує: ${missing.join(', ')}`,
               '✏️ Редагувати — дозаповнити й опублікувати');
  }
  if (o.dup_of) lines.push(`⚠ можливий дублікат (~${Math.round((o.dup_score || 0) * 100)}%)`);
  if (o.summary) lines.push('', escapeHtml(String(o.summary).slice(0, 400)));
  if (o.source_url) lines.push('', `🔗 <a href="${escapeHtml(o.source_url)}">Джерело</a>`);
  return lines.join('\n');
}

async function sendCandidate(chatId, o, remaining) {
  await sendMessage(chatId, candidateText(o, remaining), {
    inline_keyboard: [
      [
        { text: '✅ Додати на сайт', callback_data: `mod:add:${o.id}` },
        { text: '❌ Пропустити', callback_data: `mod:skip:${o.id}` },
      ],
      [
        { text: '⏭ Відкласти', callback_data: `mod:later:${o.id}` },
        { text: '✏️ Редагувати', url: `${SITE_URL}/admin/edit/${o.id}` },
      ],
      [
        { text: '💬 Нотатка (виправлю перед публікацією)', callback_data: `mod:note:${o.id}` },
      ],
    ],
  });
}

// Send the next pending draft (oldest first) — one candidate at a time.
async function sendNextCandidate(chatId) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { count } = await supabase.from('opportunities')
    .select('id', { count: 'exact', head: true }).eq('status', 'draft');
  const { data } = await supabase.from('opportunities')
    .select('id, title, summary, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, event_end_date, recurrence, format, cities, countries, is_international, dup_of, dup_score')
    // updated_at ASC so postponed candidates (touched now) drop to the back.
    .eq('status', 'draft').order('updated_at', { ascending: true }).limit(1);
  if (!data || !data.length) {
    // Порожня черга — не глухий кут: одразу даємо, куди піти далі.
    await sendMessage(chatId, '✅ Черга порожня — усі кандидати опрацьовані.', {
      inline_keyboard: [[
        { text: '📈 Метрики', callback_data: 'adm:stats' },
        { text: '✉️ Звернення', callback_data: 'adm:msgs' },
      ]],
    });
    return;
  }
  await sendCandidate(chatId, data[0], Math.max(0, (count || 1) - 1));
}

// ── Адмін-меню бота ────────────────────────────────────────────────────────
// Бот — найшвидший (з телефона часто єдиний) спосіб дістати цифри й чергу,
// тому він показує те саме, що адмінка, і кожна відповідь веде кнопкою на
// відповідну сторінку /admin. Одна робота — два входи, а не два різні світи.
const ADMIN_MENU = {
  inline_keyboard: [
    [{ text: '🗂 Черга модерації', callback_data: 'adm:queue' }],
    [
      { text: '📈 Метрики', callback_data: 'adm:stats' },
      { text: '✉️ Звернення', callback_data: 'adm:msgs' },
    ],
    [{ text: '🌐 Відкрити адмінку', url: `${SITE_URL}/admin` }],
  ],
};

const PRICE_MONTH = 179;
const PRICE_YEAR = 1199;

function daysAgoIso(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

// Ті самі числа, що на /admin/metrics — рахуємо їх тут, а не смикаємо
// сторінку: адмінка за кукою, а бот за chat_id, спільного входу немає.
async function adminStats(supabase) {
  const head = (table, filter = (q) => q) =>
    filter(supabase.from(table).select('id', { count: 'exact', head: true }));
  const [drafts, active, added7, closed7, msgs, sugs, waitlist, subsRes, snapsRes] =
    await Promise.all([
      head('opportunities', (q) => q.eq('status', 'draft')),
      head('opportunities', (q) => q.eq('status', 'active')),
      head('opportunities', (q) => q.gte('created_at', daysAgoIso(7))),
      head('opportunities', (q) => q.eq('status', 'closed').gte('updated_at', daysAgoIso(7))),
      head('contact_messages', (q) => q.eq('status', 'new')),
      head('opportunity_suggestions', (q) => q.neq('status', 'done')),
      head('plus_waitlist'),
      supabase.from('digest_subscribers').select('billing_period').eq('status', 'active'),
      supabase.from('metrics_daily').select('day, telegram_members')
        .order('day', { ascending: false }).limit(14),
    ]);

  const subs = subsRes.data || [];
  const yearly = subs.filter((x) => x.billing_period === 'yearly').length;
  const mrr = Math.round((subs.length - yearly) * PRICE_MONTH + yearly * (PRICE_YEAR / 12));
  const snaps = snapsRes.data || [];
  const weekAgo = snaps.find((x) => x.day <= daysAgoIso(7).slice(0, 10));
  const tg = snaps[0]?.telegram_members ?? null;
  const tgDelta = tg != null && weekAgo?.telegram_members != null
    ? tg - weekAgo.telegram_members : null;

  return {
    drafts: drafts.count ?? 0,
    active: active.count ?? 0,
    added7: added7.count ?? 0,
    closed7: closed7.count ?? 0,
    messages: (msgs.count ?? 0) + (sugs.count ?? 0),
    waitlist: waitlist.count ?? 0,
    plus: subs.length,
    mrr,
    tg,
    tgDelta,
  };
}

async function sendAdminMenu(chatId) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  let line = '';
  try {
    const s = await adminStats(supabase);
    line = `\n🗂 у черзі: <b>${s.drafts}</b> · ✉️ нових звернень: <b>${s.messages}</b>\n`;
  } catch {}
  await sendMessage(chatId,
    `🛠 <b>Адмінка Dityam.com.ua</b>${line}\n` +
    'Команди: /черга · /метрики · /звернення · /меню',
    ADMIN_MENU);
}

async function sendAdminStats(chatId) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  let s;
  try {
    s = await adminStats(supabase);
  } catch {
    await sendMessage(chatId, 'Не вдалося порахувати — спробуйте ще раз за хвилину.');
    return;
  }
  const tgLine = s.tg == null
    ? '📣 Telegram-канал: знімків ще немає'
    : `📣 Telegram-канал: <b>${s.tg}</b>${s.tgDelta ? ` (${s.tgDelta > 0 ? '+' : ''}${s.tgDelta} за 7 днів)` : ''}`;
  await sendMessage(chatId, [
    '📊 <b>Стан Dityam.com.ua</b>',
    '',
    `✅ На сайті: <b>${s.active}</b> можливостей`,
    `➕ За 7 днів: додано <b>${s.added7}</b>, закрито ${s.closed7}`,
    `🗂 Черга модерації: <b>${s.drafts}</b>`,
    `✉️ Нових звернень: <b>${s.messages}</b>`,
    tgLine,
    `🚀 Dityam+: ${s.waitlist} у списку очікування · ${s.plus} платних (MRR ${s.mrr} грн)`,
  ].join('\n'), {
    inline_keyboard: [[
      { text: '📈 Метрики повністю', url: `${SITE_URL}/admin/metrics` },
      { text: '🗂 Черга', callback_data: 'adm:queue' },
    ]],
  });
}

async function sendAdminMessages(chatId) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const [msgRes, sugRes] = await Promise.all([
    supabase.from('contact_messages').select('name, contact, message, page, created_at')
      .eq('status', 'new').order('created_at', { ascending: false }).limit(5),
    supabase.from('opportunity_suggestions').select('title, url, contact, created_at')
      .neq('status', 'done').order('created_at', { ascending: false }).limit(5),
  ]);
  const rows = [
    ...(msgRes.data || []).map((m) => ({
      when: m.created_at,
      text: `✉️ <b>${escapeHtml(m.name || m.contact || 'без імені')}</b>` +
            `${m.page ? ` · ${escapeHtml(m.page)}` : ''}\n${escapeHtml(String(m.message || '').slice(0, 200))}`,
    })),
    ...(sugRes.data || []).map((x) => ({
      when: x.created_at,
      text: `💡 <b>Пропозиція можливості</b>\n${escapeHtml(x.title || x.url || '')}` +
            `${x.contact ? `\n${escapeHtml(x.contact)}` : ''}`,
    })),
  ].sort((a, b) => new Date(b.when) - new Date(a.when)).slice(0, 5);

  if (!rows.length) {
    await sendMessage(chatId, '✅ Нових звернень немає.', {
      inline_keyboard: [[{ text: '✉️ Усі звернення', url: `${SITE_URL}/admin/messages` }]],
    });
    return;
  }
  await sendMessage(chatId,
    `✉️ <b>Нові звернення</b>\n\n${rows.map((r) => r.text).join('\n\n')}`,
    { inline_keyboard: [[{ text: '✉️ Відповісти в адмінці', url: `${SITE_URL}/admin/messages` }]] });
}

// Тап по кнопці «Хочу першим» у пості каналу: t.me/DityamComUABot?start=plus.
// Зберігаємо chat_id у список очікування — це прямий канал, цінніший за email:
// коли Dityam+ запуститься, напишемо людині сюди.
async function handlePlusWaitlist(msg) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return new Response('ok');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const chatId = String(msg.chat.id);
  const username = msg.from?.username ? `@${msg.from.username}` : null;

  const { data: existing } = await supabase.from('plus_waitlist')
    .select('id').eq('telegram_chat_id', chatId).maybeSingle();

  if (!existing) {
    await supabase.from('plus_waitlist').insert({
      telegram_chat_id: chatId,
      telegram_username: username,
      source: 'telegram_post',
    });
    // Сповіщення адміну — лише про нових, повторні тапи не шумлять.
    if (ADMIN_CHAT_ID) {
      await sendMessage(ADMIN_CHAT_ID,
        `🚀 <b>Dityam+ — новий у списку очікування</b>
${username || chatId} · з телеграм-посту`);
    }
  }

  await sendMessage(msg.chat.id, existing
    ? 'Ви вже в списку перших 🧡 Щойно Dityam+ запуститься — напишемо вам сюди.'
    : 'Ви в списку перших! 🧡\n\nDityam+ — платна підписка: 179 грн/міс або 1 199 грн/рік. Щодня добираємо можливості окремо для кожної вашої дитини — за віком, вподобаннями й містом. Плюс нагадування про дедлайни завчасно: за 2–4 тижні для стипендій, грантів і обмінів, за тиждень — для курсів і гуртків.\n\nЩойно запустимось — напишемо вам сюди першим, зі знижкою для перших. А платформа Dityam.com.ua лишається безкоштовною для всіх.');
  return new Response('ok');
}

// Батько відкрив t.me/DityamComUABot?start=<token> → привʼязуємо його chat_id
// до підписки на персональну підбірку (Dityam+).
async function handleDigestConnect(token, msg) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return new Response('ok');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data } = await supabase.from('digest_subscribers')
    .update({ telegram_chat_id: String(msg.chat.id), updated_at: new Date().toISOString() })
    .eq('unsub_token', token).eq('channel', 'telegram').select('id').maybeSingle();
  await sendMessage(msg.chat.id, data
    ? '✅ Канал підключено! Щойно оплата пройде — надсилатимемо персональну підбірку сюди раз на 2 тижні.\n\nВідписатись будь-коли — /stop'
    : 'Не знайшли підписку за цим посиланням. Оформити підбірку — dityam.com.ua/plus 🧡');
  return new Response('ok');
}

async function handleDigestStop(msg) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return new Response('ok');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data } = await supabase.from('digest_subscribers')
    .update({ status: 'unsubscribed', updated_at: new Date().toISOString() })
    .eq('telegram_chat_id', String(msg.chat.id)).select('id');
  await sendMessage(msg.chat.id, data && data.length
    ? 'Відписано ✅ Більше не надсилатимемо підбірку. Повернутись — dityam.com.ua/plus'
    : 'Активної підписки не знайдено.');
  return new Response('ok');
}


// Admin taps ✅/❌ on an agent candidate → publish (active) or hide (closed).
async function handleModeration(action, id, cbq) {
  const fromId = String(cbq.from?.id || '');
  const chatId = String(cbq.message?.chat?.id || '');
  if (!isAdmin(fromId, chatId)) {
    await answerCallback(cbq.id, `Лише адміністратор. Твій id: ${fromId}`);
    return new Response('ok');
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    await answerCallback(cbq.id, 'Сервер не налаштований');
    return new Response('ok');
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const now = new Date().toISOString();

  // Кнопка могла приїхати зі старої картки, а запис відтоді змінитись —
  // тож перевіряємо обовʼязковий мінімум на сервері, перед самим записом.
  if (action === 'add') {
    const { data: row } = await supabase
      .from('opportunities')
      .select('age_from, age_to, deadline, event_end_date, recurrence, cost_type, opportunity_type, format, cities, countries, is_international')
      .eq('id', id)
      .maybeSingle();
    const missing = row ? missingRequired(row) : [];
    if (missing.length) {
      await answerCallback(cbq.id, `Не можна публікувати — бракує: ${missing.join(', ')}. Тапни ✏️ Редагувати`);
      return new Response('ok');
    }
  }

  const patch = { updated_at: now };
  if (action === 'add') { patch.status = 'active'; patch.verified_at = now; }
  else if (action === 'skip') { patch.status = 'closed'; }
  // 'later' → touch updated_at only; stays a draft, drops to the back of the queue.

  const { data, error } = await supabase
    .from('opportunities')
    .update(patch)
    .eq('id', id)
    .select('title, source, source_url, opportunity_type')
    .maybeSingle();

  if (error || !data) {
    await answerCallback(cbq.id, 'Не вдалося зберегти, спробуйте ще раз');
    return new Response('ok');
  }

  const label = action === 'add' ? '✅ Додано на сайт' : action === 'skip' ? '❌ Пропущено' : '⏭ Відкладено';
  const toast = action === 'add' ? 'Додано на сайт ✅' : action === 'skip' ? 'Пропущено' : 'Відкладено ⏭';
  await answerCallback(cbq.id, toast);
  if (cbq.message) {
    const orig = cbq.message.text || cbq.message.caption || data.title || '';
    await editMessage(cbq.message.chat.id, cbq.message.message_id, `<b>${label}</b>\n\n${escapeHtml(orig)}`);
  }
  if (action !== 'later') {
    await pushModeration({
      title: data.title,
      decision: action === 'add' ? 'Додано на сайт' : 'Пропущено',
      type: data.opportunity_type,
      url: data.source_url,
      source: data.source,
    });
  }
  // Auto-advance: show the next candidate in the queue.
  if (cbq.message) await sendNextCandidate(cbq.message.chat.id);
  return new Response('ok');
}

async function answerCallback(id, text) {
  await fetch(`${TG}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: id, text, show_alert: false }),
  }).catch(() => {});
}

async function sendGa4Event(userId, eventName, params) {
  if (!GA4_API_SECRET) return;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: `telegram-${userId}`,
      user_id: `telegram-${userId}`,
      events: [{ name: eventName, params }],
    }),
  }).catch(() => {});
}

export async function POST(request) {
  if (!SECRET) {
    return new Response('webhook secret not configured', { status: 500 });
  }
  const headerSecret = request.headers.get('x-telegram-bot-api-secret-token');
  if (headerSecret !== SECRET) {
    return new Response('forbidden', { status: 403 });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE || !BOT_TOKEN) {
    return new Response('server misconfigured', { status: 500 });
  }

  const update = await request.json().catch(() => null);
  // Bot command → start / continue the one-by-one moderation queue.
  const msg = update?.message;
  if (msg?.text) {
    const text = msg.text.trim();
    // Dityam+ digest: /start <token> прив'язує канал, /stop відписує.
    const startArg = text.match(/^\/start\s+(\S+)/i);
    if (startArg && startArg[1].toLowerCase() === 'plus') return handlePlusWaitlist(msg);
    // ?start=queue — кнопка «Модерувати в боті» з адмінки: відкриває бота
    // одразу на наступному кандидаті. Для не-адміна це не спецпосилання,
    // тож воно падає далі, у звичайну привʼязку підписки.
    if (startArg && startArg[1].toLowerCase() === 'queue' && isAdmin(msg.from?.id, msg.chat.id)) {
      await sendNextCandidate(msg.chat.id);
      return new Response('ok');
    }
    if (startArg) return handleDigestConnect(startArg[1], msg);          // /start <token> — привʼязка з вебформи
    if (/^\/stop\b/i.test(text)) return handleDigestStop(msg);
    // Адмінські команди. Порядок важливий: «/стан» і «/старт» різняться
    // лише однією літерою, тож черга ловиться точним переліком слів.
    if (isAdmin(msg.from?.id, msg.chat.id)) {
      if (/^\/(menu|меню|help|довідка|адмін)/i.test(text)) {
        await sendAdminMenu(msg.chat.id);
        return new Response('ok');
      }
      if (/^\/(stats|metrics|метрик|стан|цифри)/i.test(text)) {
        await sendAdminStats(msg.chat.id);
        return new Response('ok');
      }
      if (/^\/(messages|звернення|пошта)/i.test(text)) {
        await sendAdminMessages(msg.chat.id);
        return new Response('ok');
      }
    }
    // Адмінська черга модерації.
    if (/^\/(start|next|queue|moderate|черга|модерац|далі)/i.test(text)) {
      if (isAdmin(msg.from?.id, msg.chat.id)) {
        await sendNextCandidate(msg.chat.id);
      }
      return new Response('ok');
    }

    // Не команда: якщо чекаємо нотатку від адміна — це вона.
    if (!text.startsWith('/') && isAdmin(msg.from?.id, msg.chat.id)) {
      const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
      const { data: st } = await supabase.from('admin_state')
        .select('awaiting_note_for').eq('chat_id', String(msg.chat.id)).maybeSingle();
      if (st?.awaiting_note_for) {
        await supabase.from('opportunities')
          .update({ moderation_note: text.slice(0, 1000), note_status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', st.awaiting_note_for);
        await supabase.from('admin_state').delete().eq('chat_id', String(msg.chat.id));
        await sendMessage(msg.chat.id,
          '✍️ Нотатку збережено. Опрацюю і поверну оновлену картку на апрув — зазвичай протягом години.');
        return new Response('ok');
      }
    }
    return new Response('ok');
  }

  const cbq = update?.callback_query;
  if (!cbq) {
    return new Response('ok');
  }

  // ▶️ "Переглянути" on the "N new candidates" ping → start the one-by-one queue.
  if (cbq.data === 'mod:next') {
    const fromId = String(cbq.from?.id || '');
    const chatId = String(cbq.message?.chat?.id || '');
    const ok = isAdmin(fromId, chatId);
    if (ok) {
      // Visible toast first so the tap never looks like a no-op, then the card.
      await answerCallback(cbq.id, 'Показую наступного…');
      if (cbq.message) await sendNextCandidate(cbq.message.chat.id);
    } else {
      // Surface the id so the admin can set TELEGRAM_ADMIN_CHAT_ID correctly.
      await answerCallback(cbq.id, `Лише адміністратор. Твій id: ${fromId}`);
    }
    return new Response('ok');
  }

  // Кнопки адмін-меню: та сама інформація, що на сторінках /admin.
  const adm = (cbq.data || '').match(/^adm:(menu|queue|stats|msgs)$/);
  if (adm) {
    const fromId = String(cbq.from?.id || '');
    const chatId = String(cbq.message?.chat?.id || '');
    if (!isAdmin(fromId, chatId)) {
      await answerCallback(cbq.id, `Лише адміністратор. Твій id: ${fromId}`);
      return new Response('ok');
    }
    await answerCallback(cbq.id, 'Готую…');
    if (adm[1] === 'queue') await sendNextCandidate(chatId);
    else if (adm[1] === 'stats') await sendAdminStats(chatId);
    else if (adm[1] === 'msgs') await sendAdminMessages(chatId);
    else await sendAdminMenu(chatId);
    return new Response('ok');
  }

  // 💬 Нотатка: наступне текстове повідомлення адміна стане інструкцією
  // для LLM («виправ вік», «додай місто», «перепиши заголовок») — скрипт
  // застосує її до чернетки й поверне картку на апрув.
  const noteBtn = (cbq.data || '').match(/^mod:note:(.+)$/);
  if (noteBtn) {
    const fromId = String(cbq.from?.id || '');
    const chatId = String(cbq.message?.chat?.id || '');
    if (!isAdmin(fromId, chatId)) {
      await answerCallback(cbq.id, `Лише адміністратор. Твій id: ${fromId}`);
      return new Response('ok');
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    await supabase.from('admin_state').upsert(
      { chat_id: chatId, awaiting_note_for: noteBtn[1], created_at: new Date().toISOString() },
      { onConflict: 'chat_id' },
    );
    await answerCallback(cbq.id, 'Чекаю нотатку');
    await sendMessage(chatId,
      '💬 Напишіть нотатку одним повідомленням — що виправити чи додати.\n' +
      'Напр.: «вік 6–12», «це Київ, офлайн», «перепиши заголовок коротше».\n' +
      'Застосую і поверну картку на апрув.');
    return new Response('ok');
  }

  // Moderation buttons on agent candidates (admin only).
  const mod = (cbq.data || '').match(/^mod:(add|skip|later):(.+)$/);
  if (mod) {
    return handleModeration(mod[1], mod[2], cbq);
  }

  // Суфікс :a|:b — варіант тексту посту (A/B). Необовʼязковий: пости,
  // відправлені до запуску експерименту, приходять без нього.
  const m = (cbq.data || '').match(/^fb:(yes|no):([^:]+)(?::([ab]))?$/);
  if (!m) {
    await answerCallback(cbq.id);
    return new Response('ok');
  }
  const value = m[1];
  const opportunityId = m[2];
  const variant = m[3] || null;
  const userId = cbq.from?.id;

  if (!userId) {
    await answerCallback(cbq.id);
    return new Response('ok');
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  let toast = '';
  let action = '';
  try {
    const { data: existing } = await supabase
      .from('opportunity_feedback')
      .select('value')
      .eq('opportunity_id', opportunityId)
      .eq('telegram_user_id', userId)
      .maybeSingle();

    if (existing && existing.value === value) {
      await supabase
        .from('opportunity_feedback')
        .delete()
        .eq('opportunity_id', opportunityId)
        .eq('telegram_user_id', userId);
      toast = 'Голос знято';
      action = 'remove';
    } else {
      await supabase
        .from('opportunity_feedback')
        .upsert(
          {
            opportunity_id: opportunityId,
            telegram_user_id: userId,
            value,
            ...(variant ? { variant } : {}),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'opportunity_id,telegram_user_id' },
        );
      toast = 'Дякуємо за зворотній зв’язок';
      action = existing ? 'switch' : 'add';
    }
  } catch (err) {
    await answerCallback(cbq.id, 'Не вдалося зберегти, спробуйте ще раз');
    return new Response('error', { status: 200 });
  }

  // Best-effort: enrich with title/slug for readable GA reports.
  let title = null;
  let slug = null;
  try {
    const { data: opp } = await supabase
      .from('opportunities')
      .select('title, slug')
      .eq('id', opportunityId)
      .maybeSingle();
    title = opp?.title || null;
    slug = opp?.slug || null;
  } catch {}

  await sendGa4Event(userId, 'opportunity_feedback', {
    value,
    action,
    copy_variant: variant || 'legacy',
    opportunity_id: opportunityId,
    opportunity_slug: slug,
    opportunity_title: title,
    source: 'telegram',
    // GA4 recommended param so this shows in standard "engagement" reports.
    engagement_time_msec: 1,
  });

  await answerCallback(cbq.id, toast);
  return new Response('ok');
}

export async function GET() {
  return new Response('telegram webhook', { status: 200 });
}
