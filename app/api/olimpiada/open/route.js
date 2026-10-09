// Відповідь на відкрите завдання — після завдань із варіантами й без таймера
// (Марія, 07.10.2026). Приймаємо один раз: журі читає саме те, що дитина
// надіслала. Місяць конкурсу — той, коли завершено тест (month_key).
import { cleanOpenAnswer } from '@/lib/olimpiada';
import { getStore, validToken, json, notifyAdmin, esc } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad_request' }, 400); }
  if (!validToken(b.t)) return json({ error: 'not_found' }, 404);
  const store = getStore();
  if (!store) return json({ error: 'unavailable' }, 503);

  const entry = await store.get(b.t);
  if (!entry) return json({ error: 'not_found' }, 404);
  if (!entry.finished_at) return json({ error: 'not_finished' }, 409);
  if (entry.open_answer) return json({ ok: true, already: true });

  const open = cleanOpenAnswer(b.open);
  if (!open) return json({ error: 'empty' }, 400);
  await store.update(entry.token, { open_answer: open, open_answer_at: new Date().toISOString() });
  // Відповідь для журі — одразу в адмін-чат (Марія, 09.10.2026).
  await notifyAdmin(`✍️ <b>Олімпіада: відкрите завдання${entry.wfp_last_status === 'Test' ? ' (тест адміна)' : ''}</b>\n`
    + `${esc(entry.child_name)} · ${entry.score} з ${entry.max_score}\n\n${esc(open.slice(0, 1500))}`);
  return json({ ok: true });
}
