import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';
import { pushModeration } from '@/lib/notion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// action → { patch applied to the row, Notion decision label }
const ACTIONS = {
  approve: { status: 'active', decision: 'Додано на сайт', verify: true },   // draft → live
  skip:    { status: 'closed', decision: 'Пропущено' },                       // draft → hidden
  verify:  { decision: 'Перевірено', verify: true },                          // active link ok
  remove:  { status: 'closed', decision: 'Прибрано' },                        // active → hidden
  comment: { decision: 'Коментар' },                                          // note only
};

export async function POST(request) {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  if (!token || !cookie || !safeEqual(cookie, token)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  const { id, action, comment } = await request.json().catch(() => ({}));
  const spec = ACTIONS[action];
  if (!id || !spec) {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, error: 'server' }, { status: 500 });
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const patch = { updated_at: new Date().toISOString() };
  if (spec.status) patch.status = spec.status;
  if (spec.verify) patch.verified_at = new Date().toISOString();
  if (typeof comment === 'string' && comment.trim()) patch.admin_comment = comment.trim();

  const { data, error } = await supabase
    .from('opportunities')
    .update(patch)
    .eq('id', id)
    .select('title, source, source_url, opportunity_type')
    .maybeSingle();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  // Mirror to Notion (best-effort; no-op if not configured).
  await pushModeration({
    title: data.title,
    comment: (comment || '').trim(),
    decision: spec.decision,
    type: data.opportunity_type,
    url: data.source_url,
    source: data.source,
  });

  return Response.json({ ok: true, action });
}
