import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/adminAuth';
import { AWARDS } from '@/lib/obraz';
import { obrazDb, decide } from '@/lib/obraz-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** «Опублікувати» / «Не підходить» для малюнка в «Черзі» (app/admin/ObrazQueue.js). */
export async function POST(request) {
  if (!isAdmin(cookies().get('dityam_admin')?.value)) return Response.json({ ok: false }, { status: 403 });
  const { id, action, award } = await request.json().catch(() => ({}));
  if (!id || !['approve', 'reject'].includes(action)) return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
  const db = obrazDb();
  if (!db) return Response.json({ ok: false, error: 'server' }, { status: 500 });
  const r = await decide(db, id, { action, award: AWARDS.includes(award) ? award : null });
  if (r.error) return Response.json({ ok: false, error: r.error }, { status: r.error === 'already' ? 409 : 500 });
  return Response.json({ ok: true, mailed: r.mailed });
}
