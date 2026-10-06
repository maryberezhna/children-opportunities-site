// Здача тесту: бали рахує сервер за порядком, виданим цій дитині. Після
// дедлайну (плюс запас на мережу) приймаємо те, що надіслано, — таймер у
// браузері сам здає роботу, коли час вийшов.
import { BANK } from '@/content/olimpiada/lohika-9-11';
import { OLIMP, scoreAnswers, levelFor, deadlineOf, monthKey } from '@/lib/olimpiada';
import { getStore, validToken, notifyAdmin, esc, json, loadKeys } from '@/lib/olimpiada-server';

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
  if (!entry.paid_at) return json({ error: 'unpaid' }, 402);
  if (!entry.started_at) return json({ error: 'not_started' }, 409);
  if (entry.finished_at) return json({ ok: true, already: true });

  // Відповіді, що прийшли надто пізно, не зараховуємо: інакше таймер можна
  // обійти, просто не закриваючи вкладку. Сам запис усе одно закриваємо.
  const late = Date.now() > deadlineOf(entry.started_at).getTime() + OLIMP.graceSeconds * 1000;
  const answers = {};
  if (!late && b.answers && typeof b.answers === 'object') {
    for (const o of entry.question_order || []) {
      const v = b.answers[o.id];
      if (Number.isInteger(v) && v >= 0 && v < 4) answers[o.id] = v;
    }
  }
  // Без ключів бали були б нулями — краще чесно відмовити й дати повторити.
  const keys = await loadKeys(OLIMP.slug);
  if (!keys) return json({ error: 'unavailable' }, 503);
  const { score, max } = scoreAnswers(BANK, entry.question_order, answers, keys);
  const level = levelFor(score);
  const now = new Date();
  await store.update(entry.token, {
    finished_at: now.toISOString(), answers, score, max_score: max, level: level.key, month_key: monthKey(now),
  });
  await notifyAdmin(
    `🧩 <b>Олімпіада: результат</b>\n${esc(entry.child_name)}, ${esc(entry.child_age)} р.\n`
    + `${score} з ${max} · ${esc(level.label)}${late ? ' · здано після часу' : ''}`,
  );
  return json({ ok: true });
}
