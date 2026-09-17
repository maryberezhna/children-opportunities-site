/**
 * Підозри щодо дат і типу, які модератор мусить побачити в черзі ДО схвалення.
 *
 * Привід — «Учнівська академія ветеринарної медицини» (17.09.2026). У
 * джерелі: онлайн-навчання 27–29 жовтня, реєстрація через форму, дедлайну
 * подачі немає. У базі: тип «Курс», deadline 27 жовтня, кінець події 29
 * жовтня, початку немає. Старий промпт екстрактора наказував класти перший
 * день проведення в deadline, а перерозмітка (remark.py) черги не бачила —
 * брала лише активні записи. Картка модерації показувала тільки
 * «⏰ 2026-10-27», і запис пішов на сайт як курс «із заявками до 27 жовтня».
 *
 * Тут два сигнали, обидва — підказка людині, а не автоматична правка:
 *   1. deadline без дати початку, а кінець події — за кілька днів після нього.
 *      Це відбиток старої розмітки: «дедлайн» насправді перший день події.
 *   2. Тип тривалого навчання (курс, гурток, менторство), а подія триває
 *      кілька днів. Інтенсив, вишкіл чи зустріч — не курс, і батько, що
 *      шукає заняття на рік, отримає не те.
 */
import { TYPE_LABELS } from './labels.js';
import { daysUntil, formatDate } from './dates.js';
import { plural } from './plural.js';

// Скільки днів між «дедлайном» і кінцем події ще схоже на одну подію, а не
// на справжній дедлайн задовго до неї. Англійська школа «21–25 вересня»,
// зустріч UNICEF «20 вересня» — 0–4 дні; справжні дедлайни в базі стоять за
// тижні до події.
const SHORT_EVENT_DAYS = 14;

const LONG_RUNNING_TYPES = new Set(['course', 'club', 'mentorship']);

const daysWord = (n) => plural(n, 'день', 'дні', 'днів');

export function dateWarnings(o = {}) {
  const out = [];
  const { deadline, event_start_date: start, event_end_date: end } = o;

  // Відбиток старої розмітки: перший день події лежить у deadline.
  const legacy = Boolean(deadline && !start && end);
  const gap = legacy ? daysUntil(end, deadline) : null;
  const looksLikeStart = gap !== null && gap >= 0 && gap <= SHORT_EVENT_DAYS;
  if (looksLikeStart) {
    out.push(`Дедлайн ${formatDate(deadline)} і кінець події ${formatDate(end)} поруч, `
      + 'а дати початку немає — схоже, це перший день події, а не останній день подачі. '
      + 'Звір із джерелом.');
  }

  if (LONG_RUNNING_TYPES.has(o.opportunity_type)) {
    // Тривалість рахуємо з дат проведення; для старої розмітки — від
    // «дедлайну», який за першим сигналом і є початком.
    const from = start || (looksLikeStart ? deadline : null);
    const span = from && end ? daysUntil(end, from) : null;
    if (span !== null && span >= 0 && span < SHORT_EVENT_DAYS) {
      const days = span + 1;
      out.push(`Тип «${TYPE_LABELS[o.opportunity_type]}», а подія триває ${days} ${daysWord(days)} — `
        + 'це точно не інтенсив, зустріч чи інший короткий захід? Перевір тип.');
    }
  }

  return out;
}
