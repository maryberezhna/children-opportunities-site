import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { isAdmin, adminName } from '@/lib/adminAuth';
import { CANDIDATE_ACTIONS } from '@/lib/source-candidates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Рішення людини про джерела: кандидата — беремо чи ні, підключене джерело —
 * увімкнути чи вимкнути.
 *
 * Два різні «вмикання». У кандидата його немає: щоб сайт справді обходився,
 * під нього треба дописати зчитувач у коді. «Беремо» означає рівно одне —
 * рішення прийняте, сайт чекає на зчитувач. У вже підключеного джерела
 * sources.enabled — справжній перемикач: конвеєр читає саме його.
 */
export async function POST(request) {
  const cookie = cookies().get('dityam_admin')?.value;
  if (!isAdmin(cookie)) return Response.json({ ok: false }, { status: 403 });

  const { kind, id, action, comment } = await request.json().catch(() => ({}));
  if (!id) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  if (kind === 'candidate') {
    const status = CANDIDATE_ACTIONS[action];
    if (!status) return Response.json({ ok: false, error: 'bad_action' }, { status: 400 });
    const patch = { status, decided_at: status === 'pending' ? null : new Date().toISOString() };
    const text = typeof comment === 'string' ? comment.trim().slice(0, 500) : '';
    if (text) patch.admin_comment = text;
    const { error } = await supabase.from('source_candidates').update(patch).eq('id', id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    return Response.json({ ok: true, status });
  }

  if (kind === 'source') {
    if (action !== 'on' && action !== 'off') {
      return Response.json({ ok: false, error: 'bad_action' }, { status: 400 });
    }
    const enabled = action === 'on';
    const { error } = await supabase.from('sources').update({ enabled }).eq('id', id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
    // Хто вимкнув джерело — питання, яке виникає через тиждень, коли записи
    // звідти перестали приходити. Мовчки: рішення вже записане.
    try {
      await supabase.from('moderation_actions').insert({
        opportunity_id: null, action: enabled ? 'source_on' : 'source_off',
        actor: adminName(cookie) || 'невідомий',
      });
    } catch { /* журнал мовчить і нічого не ламає */ }
    return Response.json({ ok: true, enabled });
  }

  return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
}
