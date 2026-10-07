// Здача завдань із варіантами: бали рахує сервер за порядком, виданим цій
// дитині. Коли час вийшов, браузер здає роботу сам; що прийшло пізніше
// (плюс запас на мережу), не зараховуємо. Відкрите завдання — без таймера
// (07.10.2026) і йде окремо, після цього кроку: /api/olimpiada/open.
import { BANK } from '@/content/olimpiada/lohika-9-11';
import { OLIMP, scoreAnswers, levelFor, acceptUntil, monthKey, cleanOpenAnswer } from '@/lib/olimpiada';
import { getStore, validToken, json, loadKeys } from '@/lib/olimpiada-server';

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
  const late = Date.now() > acceptUntil(entry.started_at).getTime();
  const answers = {};
  if (!late && b.answers && typeof b.answers === 'object') {
    for (const o of entry.question_order || []) {
      const v = b.answers[o.id];
      if (Number.isInteger(v) && v >= 0 && v < 4) answers[o.id] = v;
    }
  }
  // Відкрите завдання тепер надсилає /api/olimpiada/open. Якщо воно все ж
  // прийшло разом із завданнями (стара вкладка), беремо: таймера на ньому немає.
  const open = cleanOpenAnswer(b.open);
  // Без ключів бали були б нулями — краще чесно відмовити й дати повторити.
  const keys = await loadKeys(OLIMP.slug);
  if (!keys) return json({ error: 'unavailable' }, 503);
  const { score, max } = scoreAnswers(BANK, entry.question_order, answers, keys);
  const level = levelFor(score);
  const now = new Date();
  const month = monthKey(now);
  await store.update(entry.token, {
    finished_at: now.toISOString(), answers, score, max_score: max, level: level.key, month_key: month,
    ...(open ? { open_answer: open, open_answer_at: now.toISOString() } : {}),
  });
  // Результат кожного тесту в чат більше не шлемо: 07.10.2026 Марія: «в адмінці лише найнеобхідніше — найбільші проблеми, звернення й покупки з сайту».
  // Бали й відкриті відповіді для журі — у /admin/metrics (lib/olimpiada-stats.js).
  return json({ ok: true });
}
