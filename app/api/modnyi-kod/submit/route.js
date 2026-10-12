// Здача тесту: бали рахує сервер за ключами з бази. Що прийшло пізніше за час
// (плюс запас на мережу) — не зараховуємо.
import { BANK } from '@/content/modnyi-kod/bank';
import { validMkToken, mkScore, mkAcceptUntil } from '@/lib/modnyi-kod';
import { mkDb, entryByToken, updateEntry, mkKeys, serverEvent } from '@/lib/modnyi-kod-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  if (!validMkToken(b.t)) return json({ error: 'not_found' }, 404);
  const db = mkDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  const row = await entryByToken(db, b.t).catch(() => null);
  if (!row) return json({ error: 'not_found' }, 404);
  if (!row.started_at) return json({ error: 'not_started' }, 409);
  if (row.finished_at) return json({ ok: true, already: true });
  const late = Date.now() > mkAcceptUntil(row.started_at).getTime();
  const answers = {};
  if (!late && b.answers && typeof b.answers === 'object') {
    for (const o of row.question_order || []) {
      const v = b.answers[o.id];
      if (Number.isInteger(v) && v >= 0 && v < 4) answers[o.id] = v;
    }
  }
  const keys = await mkKeys();
  if (!keys) return json({ error: 'unavailable' }, 503);
  const { score, max, missed } = mkScore(BANK, row.question_order, answers, keys);
  await updateEntry(db, b.t, { finished_at: new Date().toISOString(), answers, score, max_score: max, missed_questions: missed });
  await serverEvent(db, 'mk_test_done');
  return json({ ok: true, score, max });
}
