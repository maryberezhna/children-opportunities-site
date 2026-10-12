// Образ зі студії: зберігаємо (лише відомі речі й тканини) і кажемо адміну —
// Марія переглядає назву перед публікацією в соцмережах.
import { cleanLook } from '@/lib/modnyi-kod-looks';
import { MK, validMkToken } from '@/lib/modnyi-kod';
import { mkDb, entryByToken, updateEntry, notifyAdmin, serverEvent } from '@/lib/modnyi-kod-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const THEMES = ['pink', 'lavender', 'blue'];
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  if (!validMkToken(b.t)) return json({ error: 'not_found' }, 404);
  const title = String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, MK.titleMax);
  if (title.length < 2) return json({ error: 'title' }, 400);
  const db = mkDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  const row = await entryByToken(db, b.t).catch(() => null);
  if (!row) return json({ error: 'not_found' }, 404);
  if (!row.finished_at) return json({ error: 'not_finished' }, 409);
  const first = !row.look_at;
  await updateEntry(db, b.t, { look: cleanLook(b.look), look_title: title, cover_theme: THEMES.includes(b.theme) ? b.theme : 'pink', look_at: new Date().toISOString() });
  if (first) {
    await serverEvent(db, 'mk_cover_done');
    await notifyAdmin(`👗 <b>«${MK.title}»: нова обкладинка</b>\n${esc(row.child_name)}, ${row.child_age} · «${esc(title)}» · ${row.score}/${row.max_score}\nПереглянь назву перед публікацією в соцмережах.`);
  }
  return json({ ok: true });
}
