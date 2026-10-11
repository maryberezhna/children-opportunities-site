// «Прибрати малюнок з галереї» — посилання з листа батькам. Лише POST із
// кнопки на сторінці /obraz/prybraty: поштові сканери відкривають посилання
// з листів самі, і GET прибрав би малюнок без відома батьків.
import { validToken } from '@/lib/obraz';
import { obrazDb, removeByToken } from '@/lib/obraz-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { t } = await request.json().catch(() => ({}));
  if (!validToken(t)) return Response.json({ error: 'not_found' }, { status: 404 });
  const db = obrazDb();
  if (!db) return Response.json({ error: 'unavailable' }, { status: 503 });
  try {
    const row = await removeByToken(db, t);
    if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    console.error('[obraz/remove]', e?.message || e);
    return Response.json({ error: 'unavailable' }, { status: 503 });
  }
}
