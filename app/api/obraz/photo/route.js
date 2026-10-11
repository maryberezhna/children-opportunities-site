// Інше фото до тієї самої заявки: коли Марія попросила замінити (reupload) —
// без доплати — або ще до оплати. Ті самі перевірки файлу, що й у формі.
import { validToken, checkJpeg, stripJpegMetadata } from '@/lib/obraz';
import { obrazDb, entryByToken, replacePhoto } from '@/lib/obraz-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'bad_request' }, 400); }
  const t = String(form.get('t') || '');
  if (!validToken(t)) return json({ error: 'not_found' }, 404);
  const file = form.get('image');
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'file' }, 400);
  const raw = Buffer.from(await file.arrayBuffer());
  const check = checkJpeg(raw);
  if (check.error) return json({ error: check.error }, 400);
  const jpeg = stripJpegMetadata(raw);
  if (!jpeg) return json({ error: 'file' }, 400);
  const db = obrazDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  try {
    const row = await entryByToken(db, t);
    if (!row) return json({ error: 'not_found' }, 404);
    const r = await replacePhoto(db, row, jpeg);
    if (r.error) return json({ error: r.error }, 409);
    return json({ ok: true });
  } catch (e) {
    console.error('[obraz/photo]', e?.message || e);
    return json({ error: 'unavailable' }, 503);
  }
}
