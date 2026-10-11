// Заявка на челендж «Намалюй свій образ»: батьки надсилають фото малюнка й
// кілька полів. Малюнок одразу НЕ публікується — він чекає в «Черзі», доки
// Марія не натисне «Опублікувати» (app/admin/ObrazQueue.js).
import { kyivToday } from '@/lib/dates';
import { OBRAZ, cleanEntry, checkJpeg, stripJpegMetadata, themeOpen } from '@/lib/obraz';
import { obrazDb, recentCount, createEntry, notifyAdmin } from '@/lib/obraz-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function POST(request) {
  let form;
  try { form = await request.formData(); } catch { return json({ error: 'bad_request' }, 400); }
  // Приманка для ботів: людина цього поля не бачить.
  if (form.get('website')) return json({ ok: true });
  if (!themeOpen(kyivToday())) return json({ error: 'closed' }, 403);

  const { entry, error } = cleanEntry({
    name: form.get('name'), age: form.get('age'), title: form.get('title'), story: form.get('story'),
    email: form.get('email'), consent: form.get('consent') === 'on', instagram: form.get('instagram') === 'on',
  });
  if (error) return json({ error }, 400);

  const file = form.get('image');
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'file' }, 400);
  const raw = Buffer.from(await file.arrayBuffer());
  const check = checkJpeg(raw);
  if (check.error) return json({ error: check.error }, 400);
  // GPS та інші метадані — геть, навіть якщо браузер їх уже прибрав.
  const jpeg = stripJpegMetadata(raw);
  if (!jpeg) return json({ error: 'file' }, 400);

  const db = obrazDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  try {
    if (await recentCount(db, entry.parent_email) >= OBRAZ.maxPerEmailDay) return json({ error: 'too_many' }, 429);
    const row = await createEntry(db, entry, jpeg, { source: form.get('source') });
    // Малюнок чекає на рішення — це дія для Марії, тож в адмін-чат.
    await notifyAdmin(`🎨 <b>Новий малюнок на перевірку</b>\n${escHtml(row.child_name)}, ${row.age} · «${escHtml(row.title)}»\nhttps://dityam.com.ua/admin`);
    return json({ ok: true });
  } catch (e) {
    console.error('[obraz/submit]', e?.message || e);
    return json({ error: 'unavailable' }, 503);
  }
}
