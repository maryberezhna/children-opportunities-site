import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID || 'G-KPLE8LGH91';
const GA4_API_SECRET = process.env.GA4_API_SECRET;

const TG = `https://api.telegram.org/bot${BOT_TOKEN}`;

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
  const cbq = update?.callback_query;
  if (!cbq) {
    return new Response('ok');
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
