import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { safeEqual } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = new Set(['new', 'in_progress', 'done']);

/** Зміна статусу звернення в адмінці (/admin/messages). */
export async function POST(request) {
  const token = process.env.ADMIN_TOKEN;
  const cookie = cookies().get('dityam_admin')?.value;
  if (!token || !cookie || !safeEqual(cookie, token)) {
    return Response.json({ ok: false }, { status: 403 });
  }

  const { id, status, note } = await request.json().catch(() => ({}));
  if (!id || !STATUSES.has(status)) {
    return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const patch = { status, handled_at: status === 'new' ? null : new Date().toISOString() };
  if (typeof note === 'string') patch.admin_note = note.trim().slice(0, 2000) || null;

  const { error } = await supabase.from('contact_messages').update(patch).eq('id', id);
  if (error) return Response.json({ ok: false, error: 'server' }, { status: 500 });

  return Response.json({ ok: true });
}
