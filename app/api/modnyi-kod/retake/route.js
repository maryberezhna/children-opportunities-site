// «Пройти ще раз» (Марія, 13.10.2026: «у боті можна проходити скільки хочеш
// разів… та і взагалі можна скільки хочеш разів»). Кращий результат
// зберігаємо в best_score / best_missed, тест обнуляємо — новий порядок
// завдань і варіантів (mkOrder з номером спроби). Образ і обкладинка лишаються.
import { validMkToken } from '@/lib/modnyi-kod';
import { mkDb, entryByToken, updateEntry, serverEvent } from '@/lib/modnyi-kod-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const { t } = await request.json().catch(() => ({}));
  if (!validMkToken(t)) return json({ error: 'not_found' }, 404);
  const db = mkDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  const row = await entryByToken(db, t).catch(() => null);
  if (!row) return json({ error: 'not_found' }, 404);
  if (!row.paid_at || row.refunded_at) return json({ error: 'unpaid' }, 402);
  if (!row.finished_at) return json({ ok: true, already: true });
  const better = row.best_score == null || (row.score ?? 0) >= row.best_score;
  await updateEntry(db, t, {
    attempts: (Number(row.attempts) || 1) + 1,
    best_score: better ? row.score : row.best_score,
    best_missed: better ? row.missed_questions : row.best_missed,
    started_at: null, finished_at: null, answers: null, question_order: null,
  });
  await serverEvent(db, 'mk_retake', row.source || null);
  return json({ ok: true });
}
