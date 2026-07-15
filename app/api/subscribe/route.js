import { createClient } from '@supabase/supabase-js';
import { THEME_OPTIONS } from '@/lib/themes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AGE_BANDS = ['0-3', '4-6', '7-10', '11-14', '15-18'];
const THEME_KEYS = THEME_OPTIONS.map((o) => o.value).filter((v) => v !== 'all');
const only = (arr, allowed) => [...new Set((Array.isArray(arr) ? arr : []).filter((v) => allowed.includes(v)))];

export async function POST(request) {
  const b = await request.json().catch(() => ({}));

  const channel = b.channel === 'email' ? 'email' : b.channel === 'telegram' ? 'telegram' : null;
  if (!channel) return Response.json({ ok: false, error: 'bad_channel' }, { status: 400 });
  if (!b.consent) return Response.json({ ok: false, error: 'no_consent' }, { status: 400 });

  const age_bands = only(b.age_bands, AGE_BANDS);
  const interests = only(b.interests, THEME_KEYS);
  if (!age_bands.length || !interests.length) return Response.json({ ok: false, error: 'incomplete' }, { status: 400 });

  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const handle = typeof b.telegram_handle === 'string' ? b.telegram_handle.trim().replace(/^@/, '').slice(0, 64) : '';
  if (channel === 'email' && !/^\S+@\S+\.\S+$/.test(email)) return Response.json({ ok: false, error: 'bad_email' }, { status: 400 });
  if (channel === 'telegram' && handle.length < 2) return Response.json({ ok: false, error: 'bad_handle' }, { status: 400 });

  const gender = ['boy', 'girl', 'any'].includes(b.gender) ? b.gender : 'any';
  const cost_pref = b.cost_pref === 'free_only' ? 'free_only' : 'any';

  const row = {
    channel,
    email: channel === 'email' ? email : null,
    telegram_handle: channel === 'telegram' ? `@${handle}` : null,
    age_bands, interests, gender, cost_pref,
    status: 'pending',            // активуємо після підтвердження оплати / підключення бота
    consent_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Email унікальний — повторна підписка оновлює вподобання замість дубля.
  if (channel === 'email') {
    const { data: existing } = await supabase.from('digest_subscribers').select('id, status').eq('email', email).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('digest_subscribers')
        .update({ ...row, status: existing.status === 'unsubscribed' ? 'pending' : existing.status })
        .eq('id', existing.id);
      if (error) return Response.json({ ok: false, error: 'server' }, { status: 500 });
      return Response.json({ ok: true, updated: true });
    }
  }

  const { data, error } = await supabase.from('digest_subscribers').insert(row).select('unsub_token').single();
  if (error) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  // Telegram-каналу віддаємо токен привʼязки для deep-link у бота.
  return Response.json({ ok: true, connect: channel === 'telegram' ? data.unsub_token : undefined });
}
