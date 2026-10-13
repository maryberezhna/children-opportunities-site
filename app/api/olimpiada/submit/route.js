// Здача завдань із варіантами: бали рахує сервер за порядком, виданим цій
// дитині. Коли час вийшов, браузер здає роботу сам; що прийшло пізніше
// (плюс запас на мережу), не зараховуємо. Відкрите завдання — без таймера
// (07.10.2026) і йде окремо, після цього кроку: /api/olimpiada/open.
import { BANK } from '@/content/olimpiada/lohika-9-11';
import { HINTS } from '@/content/olimpiada/hints';
import { OLIMP, scoreAnswers, missedQuestions, levelFor, acceptUntil, monthKey, cleanOpenAnswer } from '@/lib/olimpiada';
import { getStore, validToken, json, loadKeys, notifyAdmin, esc, thankTeacher } from '@/lib/olimpiada-server';
import { sendOlDiploma } from '@/lib/olimpiada-bot';

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
  // Розбір: де дитина помилилась чи не відповіла — з підказками, без відповідей.
  // Зберігаємо зараз, поки є ключі: сторінка диплома й обидва листи лише показують.
  const missed = missedQuestions(BANK, entry.question_order, answers, keys, HINTS);
  const level = levelFor(score);
  const now = new Date();
  const month = monthKey(now);
  await store.update(entry.token, {
    finished_at: now.toISOString(), answers, score, max_score: max, level: level.key, month_key: month,
    missed_questions: missed,
    ...(open ? { open_answer: open, open_answer_at: now.toISOString() } : {}),
  });
  // Кожен пройдений тест — в адмін-чат (Марія, 09.10.2026: «чому мені в
  // телеграм-адмінку не приходить» — з 07.10 туди йшли лише покупки, і
  // перших учасників вона не побачила). Тестові записи адміна — з позначкою.
  const test = entry.wfp_last_status === 'Test';
  await notifyAdmin(`🧩 <b>Олімпіада: пройшли тест${test ? ' (тест адміна)' : ''}</b>\n`
    + `${esc(entry.child_name)} · ${score} з ${max} · ${esc(level.label)}\n${esc(entry.parent_email || (entry.telegram_chat_id ? 'через Telegram' : '—'))}`
    + (open ? `\n\n✍️ Відкрите завдання:\n${esc(open.slice(0, 1500))}` : ''));
  // Заявка за посиланням педагога (11.10.2026): коли тест пройде 5-й учень
  // (TEACHER_THANKS_AT), педагогу — подяка листом. thankTeacher не кидає ніколи.
  if (entry.teacher_code) await thankTeacher(store, entry.teacher_code);
  // Записались через Telegram (13.10.2026) — диплом одразу в чат. Не кидає.
  if (entry.telegram_chat_id) await sendOlDiploma(entry, { score, max });
  return json({ ok: true });
}
