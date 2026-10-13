// Початок тесту: фіксує час старту й видає завдання без відповідей. Повторний
// виклик повертає той самий порядок і дедлайн.
import { BANK } from '@/content/modnyi-kod/bank';
import { MK, validMkToken, mkOrder, mkPublicQuestions, mkDeadline } from '@/lib/modnyi-kod';
import { mkDb, entryByToken, updateEntry } from '@/lib/modnyi-kod-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const { t } = await request.json().catch(() => ({}));
  if (!validMkToken(t)) return json({ error: 'not_found' }, 404);
  const db = mkDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  let row = await entryByToken(db, t).catch(() => null);
  if (!row) return json({ error: 'not_found' }, 404);
  if (!row.paid_at || row.refunded_at) return json({ error: 'unpaid' }, 402);
  if (row.finished_at) return json({ error: 'finished' }, 409);
  // Кожна нова спроба — новий порядок завдань і варіантів (13.10.2026).
  const seed = Number(row.attempts) > 1 ? `${t}#${row.attempts}` : t;
  if (!row.started_at) row = await updateEntry(db, t, { started_at: new Date().toISOString(), question_order: mkOrder(BANK, seed) });
  return json({ questions: mkPublicQuestions(BANK, row.question_order), deadline: mkDeadline(row.started_at).toISOString(), now: new Date().toISOString(), minutes: MK.minutes });
}
