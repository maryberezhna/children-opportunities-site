// Тренування «Модного коду» для підписників Dityam+ — без обмежень (Марія:
// «з безлімітною кількістю проходжень»). Офіційна спроба (бали на обкладинці)
// не змінюється; тренування нікуди не пишуться, крім лічильника.
// start → завдання з новим порядком варіантів; check → бали й підказки.
import { BANK } from '@/content/modnyi-kod/bank';
import { HINTS } from '@/content/modnyi-kod/hints';
import { MK, validMkToken, mkOrder, mkPublicQuestions, mkScore } from '@/lib/modnyi-kod';
import { mkDb, entryByToken, updateEntry, mkKeys, plusActive } from '@/lib/modnyi-kod-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const b = await request.json().catch(() => ({}));
  if (!validMkToken(b.t)) return json({ error: 'not_found' }, 404);
  const db = mkDb();
  if (!db) return json({ error: 'unavailable' }, 503);
  const row = await entryByToken(db, b.t).catch(() => null);
  if (!row || !row.finished_at) return json({ error: 'not_found' }, 404);
  if (row.source !== 'dityam_plus' || !(await plusActive(db, row.telegram_chat_id))) return json({ error: 'plus_only' }, 403);
  if (b.action === 'start') {
    const order = mkOrder(BANK, `${b.t}:${Date.now()}`);
    return json({ questions: mkPublicQuestions(BANK, order), order, minutes: MK.minutes });
  }
  const keys = await mkKeys();
  if (!keys) return json({ error: 'unavailable' }, 503);
  const order = Array.isArray(b.order) ? b.order.filter((o) => BANK.some((q) => q.id === o?.id)).map((o) => ({ id: o.id, options: [0, 1, 2, 3] })) : [];
  const { score, max, missed } = mkScore(BANK, order, b.answers || {}, keys);
  await updateEntry(db, b.t, { practice_count: (row.practice_count || 0) + 1 }).catch(() => {});
  const byId = new Map(BANK.map((q) => [q.id, q]));
  return json({ score, max, missed: missed.map((m) => ({ num: m.num, q: byId.get(m.id)?.q, hint: HINTS[m.id] })) });
}
