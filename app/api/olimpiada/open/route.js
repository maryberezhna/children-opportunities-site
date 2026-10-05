// Відповідь на відкрите завдання місяця — за неї змагаються за призи.
// Приймаємо лише після тесту й лише раз: журі читає перший варіант.
import { OPEN_TASK, monthKey, monthName } from '@/lib/olimpiada';
import { getStore, validToken, notifyAdmin, esc, json } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  if (!validToken(b.t)) return json({ error: 'not_found' }, 404);
  const text = String(b.text || '').trim().slice(0, OPEN_TASK.maxLength);
  if (text.length < 20) return json({ error: 'short' }, 400);

  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);
  const entry = await store.get(b.t);
  if (!entry) return json({ error: 'not_found' }, 404);
  if (!entry.finished_at) return json({ error: 'not_finished' }, 409);
  if (entry.open_answer) return json({ ok: true, already: true });

  const now = new Date();
  const key = monthKey(now);
  await store.update(entry.token, { open_answer: text, open_answer_at: now.toISOString(), month_key: key });
  await notifyAdmin(
    `✍️ <b>Олімпіада: відкрите завдання (${esc(monthName(key))})</b>\n`
    + `${esc(entry.child_name)}, ${esc(entry.child_age)} р. · ${esc(entry.score)} з ${esc(entry.max_score)}\n\n${esc(text)}`,
  );
  return json({ ok: true });
}
