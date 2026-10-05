// Початок тесту: фіксує час старту й видає завдання без правильних відповідей.
// Повторний виклик (оновили сторінку) повертає той самий порядок і той самий
// дедлайн — час не починається заново.
import { BANK } from '@/content/olimpiada/lohika-9-11';
import { OLIMP, buildOrder, publicQuestions, deadlineOf, accessExpired } from '@/lib/olimpiada';
import { getStore, validToken, json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  if (!validToken(b.t)) return json({ error: 'not_found' }, 404);
  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);

  let entry = await store.get(b.t);
  if (!entry) return json({ error: 'not_found' }, 404);
  if (!entry.paid_at) return json({ error: 'unpaid' }, 402);
  if (entry.finished_at) return json({ error: 'finished' }, 409);
  // На початок тесту є 72 години після оплати.
  if (accessExpired(entry)) return json({ error: 'expired' }, 410);

  if (!entry.started_at) {
    entry = await store.update(entry.token, {
      started_at: new Date().toISOString(),
      question_order: buildOrder(BANK, entry.token),
    });
  }
  const deadline = deadlineOf(entry.started_at);
  return json({
    questions: publicQuestions(BANK, entry.question_order),
    deadline: deadline.toISOString(),
    now: new Date().toISOString(),
    minutes: OLIMP.minutes,
  });
}
