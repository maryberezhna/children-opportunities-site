// Надсилає в канал заплановані дописи й опитування (lib/channel-schedule.js).
// Викликає cron Vercel кожні 10 хвилин; поза запланованим часом нічого не
// робить і в базу не ходить.
//
// Двічі не надсилає: перед відправкою кладе рядок у channel_scheduled_sent
// (key — первинний ключ). Не вийшло надіслати — рядок прибирає, наступний
// виклик спробує ще раз, а в адмін-чат летить сигнал: зірване заплановане —
// це проблема, а не звіт.
import { createClient } from '@supabase/supabase-js';
import { CHANNEL, SCHEDULE, dueItems } from '@/lib/channel-schedule';
import { pollByKey } from '@/scripts/channel-polls';
import { extractSlugs, linkProblems, formatProblems } from '@/scripts/post-links.mjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CRON_SECRET = process.env.CRON_SECRET;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`${method}: ${j.description || r.status}`);
  return j.result;
}

const kyivTime = (iso) => new Intl.DateTimeFormat('uk-UA', {
  timeZone: 'Europe/Kyiv', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
}).format(new Date(iso));

// Чи може бот публікувати в каналі — для превʼю за добу.
async function canPost() {
  try {
    const me = await tg('getMe', {});
    const m = await tg('getChatMember', { chat_id: CHANNEL, user_id: me.id });
    return m.status === 'creator' || (m.status === 'administrator' && m.can_post_messages !== false);
  } catch {
    return false;
  }
}

async function send(item) {
  if (item.kind === 'preview') {
    const target = SCHEDULE.find((s) => s.key === item.of);
    if (!target || !ADMIN_CHAT_ID) throw new Error(`превʼю: немає ${item.of} або TELEGRAM_ADMIN_CHAT_ID`);
    const { intro, question, options, multiple = false } = pollByKey(target.poll);
    const ok = await canPost();
    await tg('sendMessage', {
      chat_id: ADMIN_CHAT_ID, parse_mode: 'HTML', disable_web_page_preview: true,
      text: `🗓 <b>Завтра в канал</b> — ${kyivTime(target.at)}\n`
        + (ok ? '✅ Бот може публікувати в каналі.' : '❌ Бот НЕ може публікувати в каналі — перевірте права, інакше допис не вийде.')
        + `\n\nСкасувати чи змінити — рядок «${target.key}» у lib/channel-schedule.js.\n\n— — —\n\n${intro || ''}`,
    });
    // Не анонімне: у приватному чаті Telegram анонімне й не прийме.
    const poll = await tg('sendPoll', {
      chat_id: ADMIN_CHAT_ID, question, options: options.map((text) => ({ text })),
      is_anonymous: false, allows_multiple_answers: multiple,
    });
    return poll.message_id;
  }
  if (item.kind === 'poll') {
    const { intro, question, options, multiple = false } = pollByKey(item.poll);
    if (intro) {
      await tg('sendMessage', { chat_id: CHANNEL, text: intro, parse_mode: 'HTML', disable_web_page_preview: true });
    }
    const poll = await tg('sendPoll', {
      chat_id: CHANNEL, question, options: options.map((text) => ({ text })),
      is_anonymous: true, allows_multiple_answers: multiple,
    });
    return poll.message_id;
  }
  throw new Error(`невідомий kind: ${item.kind}`);
}

// Текст, який піде людям: вступ опитування (у превʼю — той самий вступ цілі).
function textOf(item) {
  const poll = item.kind === 'poll' ? item.poll : SCHEDULE.find((s) => s.key === item.of)?.poll;
  try { return poll ? pollByKey(poll).intro || '' : ''; } catch { return ''; }
}

// Можливості, на які посилається текст, мусять бути актуальними й зараз
// (Марія, 26.10.2026: «перевіряй завжди на актуальність можливості перед
// публікацією»). Python із перевіркою сторінки тут недоступний, тож — хоча б
// статус і дедлайн. Повертає список проблем.
async function staleLinks(supabase, item) {
  const slugs = extractSlugs(textOf(item));
  if (!slugs.length) return [];
  const { data, error } = await supabase.from('opportunities')
    .select('slug, title, status, canonical_slug, deadline').in('slug', slugs);
  if (error) throw new Error(`база не відповіла: ${error.message}`);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());
  return linkProblems(slugs, data, today);
}

export async function GET(request) {
  if (CRON_SECRET && request.headers.get('authorization') !== `Bearer ${CRON_SECRET}`) {
    return new Response('unauthorized', { status: 401 });
  }
  const due = dueItems(SCHEDULE, new Date());
  if (!due.length) return Response.json({ ok: true, due: 0 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const done = [];
  for (const item of due) {
    // Замок: вставка вдасться лише раз на key.
    const { error: lockErr } = await supabase.from('channel_scheduled_sent').insert({ key: item.key });
    if (lockErr) continue;                                   // уже надіслано (або надсилається)
    // Неактуальна можливість у тексті: не шлемо і не пробуємо щодесять хвилин —
    // замок лишається, сигнал в адмін-чат один раз.
    let stale = [];
    try { stale = await staleLinks(supabase, item); } catch (e) { stale = [{ slug: '—', why: e.message }]; }
    if (stale.length) {
      const msg = formatProblems(`запланований допис ${item.key}`, stale);
      console.error('[channel-scheduled]', msg);
      if (TOKEN && ADMIN_CHAT_ID) await tg('sendMessage', { chat_id: ADMIN_CHAT_ID, text: msg }).catch(() => {});
      continue;
    }
    try {
      const messageId = await send(item);
      await supabase.from('channel_scheduled_sent').update({ message_id: messageId }).eq('key', item.key);
      done.push(item.key);
    } catch (e) {
      await supabase.from('channel_scheduled_sent').delete().eq('key', item.key);
      console.error('[channel-scheduled]', item.key, e.message);
      if (TOKEN && ADMIN_CHAT_ID) {
        await tg('sendMessage', {
          chat_id: ADMIN_CHAT_ID,
          text: `⚠️ Запланований допис у канал не пішов: ${item.key}\n${e.message}\nСпробую ще раз за 10 хвилин.`,
        }).catch(() => {});
      }
    }
  }
  return Response.json({ ok: true, due: due.length, sent: done });
}
