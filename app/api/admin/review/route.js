import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Approve (draft → active, appears on the site) or skip (draft → closed, stays
// hidden) a candidate. Guarded by the admin cookie; acts only on drafts.
export async function POST(request) {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  if (!token || cookie !== token) {
    return Response.json({ ok: false }, { status: 403 });
  }

  const { id, action } = await request.json().catch(() => ({}));
  if (!id || !['approve', 'skip'].includes(action)) {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, error: 'server' }, { status: 500 });
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const status = action === 'approve' ? 'active' : 'closed';
  const { data, error } = await supabase
    .from('opportunities')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select('id');

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return Response.json({ ok: true, status });
}
