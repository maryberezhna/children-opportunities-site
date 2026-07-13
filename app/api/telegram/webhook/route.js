import { createClient } from '@supabase/supabase-js';
import { pushModeration } from '@/lib/notion';

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
  if (o.deadline) lines.push(`⏰ Дедлайн: ${o.deadline}`);
  if (o.dup_of) lines.push(`⚠ можливий дублікат (~${Math.round((o.dup_score || 0) * 100)}%)`);
  if (o.summary) lines.push('', escapeHtml(String(o.summary).slice(0, 400)));
  if (o.source_url) lines.push('', `🔗 <a href="${escapeHtml(o.source_url)}">Джерело</a>`);
  return lines.join('\n');
}

async function sendCandidate(chatId, o, remaining) {
  await sendMessage(chatId, candidateText(o, remaining), {
    inline_keyboard: [[
      { text: '✅ Додати на сайт', callback_data: `mod:add:${o.id}` },
      { text: '❌ Пропустити', callback_data: `mod:skip:${o.id}` },
    ]],
  });
}

// Send the next pending draft (oldest first) — one candidate at a time.
async function sendNextCandidate(chatId) {
  if (!SUPABASE_URL || !SERVICE_ROLE) return;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { count } = await supabase.from('opportunities')
    .select('id', { count: 'exact', head: true }).eq('status', 'draft');
  const { data } = await supabase.from('opportunities')
    .select('id, title, summary, source, source_url, opportunity_type, age_from, age_to, cost_type, deadline, dup_of, dup_score')
    .eq('status', 'draft').order('created_at', { ascending: true }).limit(1);
  if (!data || !data.length) {
    await sendMessage(chatId, '✅ Черга порожня — усі кандидати опрацьовані.');
    return;
  }
  await sendCandidate(chatId, data[0], Math.max(0, (count || 1) - 1));
}

// Admin taps ✅/❌ on an agent candidate → publish (active) or hide (closed).
async function handleModeration(action, id, cbq) {
  const fromId = String(cbq.from?.id || '');
  if (ADMIN_CHAT_ID && fromId !== String(ADMIN_CHAT_ID)) {
    await answerCallback(cbq.id, 'Лише адміністратор може модерувати');
    return new Response('ok');
  }
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    await answerCallback(cbq.id, 'Сервер не налаштований');
    return new Response('ok');
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const patch = { status: action === 'add' ? 'active' : 'closed', updated_at: new Date().toISOString() };
  if (action === 'add') patch.verified_at = new Date().toISOString();

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

  const label = action === 'add' ? '✅ Додано на сайт' : '❌ Пропущено';
  await answerCallback(cbq.id, action === 'add' ? 'Додано на сайт ✅' : 'Пропущено');
  if (cbq.message) {
    const orig = cbq.message.text || cbq.message.caption || data.title || '';
    await editMessage(cbq.message.chat.id, cbq.message.message_id, `<b>${label}</b>\n\n${escapeHtml(orig)}`);
  }
  await pushModeration({
    title: data.title,
    decision: action === 'add' ? 'Додано на сайт' : 'Пропущено',
    type: data.opportunity_type,
    url: data.source_url,
    source: data.source,
  });
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
  if (msg?.text && /^\/(start|next|moderate|черга|модерац|далі)/i.test(msg.text.trim())) {
    if (!ADMIN_CHAT_ID || String(msg.from?.id) === String(ADMIN_CHAT_ID)) {
      await sendNextCandidate(msg.chat.id);
    }
    return new Response('ok');
  }

  const cbq = update?.callback_query;
  if (!cbq) {
    return new Response('ok');
  }

  // ▶️ "Переглянути" on the "N new candidates" ping → start the one-by-one queue.
  if (cbq.data === 'mod:next') {
    if (!ADMIN_CHAT_ID || String(cbq.from?.id) === String(ADMIN_CHAT_ID)) {
      await answerCallback(cbq.id);
      if (cbq.message) await sendNextCandidate(cbq.message.chat.id);
    } else {
      await answerCallback(cbq.id, 'Лише адміністратор');
    }
    return new Response('ok');
  }

  // Moderation buttons on agent candidates (admin only).
  const mod = (cbq.data || '').match(/^mod:(add|skip):(.+)$/);
  if (mod) {
    return handleModeration(mod[1], mod[2], cbq);
  }

  const m = (cbq.data || '').match(/^fb:(yes|no):(.+)$/);
  if (!m) {
    await answerCallback(cbq.id);
    return new Response('ok');
  }
  const value = m[1];
  const opportunityId = m[2];
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
