// Здача тесту: бали рахує сервер за порядком, виданим цій дитині. Разом із
// відповідями приходить відкрите завдання — воно в тих самих хвилинах. Коли
// час вийшов, браузер ще 2 хвилини показує табло «Відправити відповідь», а
// потім здає роботу сам; після цього (плюс запас на мережу) не приймаємо.
import { BANK } from '@/content/olimpiada/lohika-9-11';
import { OLIMP, scoreAnswers, levelFor, acceptUntil, monthKey, monthName, cleanOpenAnswer } from '@/lib/olimpiada';
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
  const late = Date.now() > acceptUntil(entry.started_at).getTime();
  const answers = {};
  if (!late && b.answers && typeof b.answers === 'object') {
    for (const o of entry.question_order || []) {
      const v = b.answers[o.id];
      if (Number.isInteger(v) && v >= 0 && v < 4) answers[o.id] = v;
    }
  }
  // Відкрите завдання: що дитина встигла написати — журі читає саме це.
  const open = late ? '' : cleanOpenAnswer(b.open);
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
  await notifyAdmin(
    `🧩 <b>Олімпіада: результат</b>\n${esc(entry.child_name)}${entry.child_age ? `, ${esc(entry.child_age)} р.` : ''}\n`
    + `${score} з ${max} · ${esc(level.label)}${late ? ' · здано після часу' : ''}`
    + (open ? `\n\n✍️ <b>Відкрите завдання (${esc(monthName(month))})</b>\n${esc(open)}` : '\n✍️ відкрите завдання не надіслано'),
  );
  return json({ ok: true });
}
