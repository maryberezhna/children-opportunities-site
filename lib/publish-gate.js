/**
 * Одні ворота перед виходом запису на сайт.
 *
 * Навіщо окремий файл (02.10.2026). Публікувати запис можна чотирма шляхами:
 * кнопка в /admin, кнопка «Зберегти й опублікувати» в редакторі, ✅ у
 * адмін-боті та `scripts/publish-draft.mjs` з воркфлоу. Правила були розкидані
 * по цих чотирьох місцях і розʼїхались:
 *
 *   • /admin і воркфлоу перевіряли поля, цитати й джерело;
 *   • редактор — поля й джерело, але лише коли джерело щойно змінили;
 *   • бот — тільки поля.
 *
 * Тому на сайт потрапили пʼять записів із чужим Telegram-каналом як джерелом
 * (правило Марії 27.09.2026) і записи без жодної цитати (світлофор,
 * 22.09.2026) — не тому, що перевірок не написали, а тому, що їх не кликали.
 * Тепер перевірка одна, а тест звіряє, що її кличуть усі чотири шляхи.
 */
import { missingProof, missingRequired } from './required.js';
import { sourceProblem } from './source-rules.js';

/**
 * Поля, без яких перевірка сліпа. Кожен шлях вибирає рівно їх: читати менше —
 * означає пускати запис, бо порожнє поле в обʼєкті виглядає як порожнє в базі.
 */
export const GATE_SELECT = [
  'title', 'age_from', 'age_to', 'deadline', 'event_start_date', 'event_end_date',
  'results_date', 'recurrence', 'timing_kind', 'cost_type', 'opportunity_type',
  'format', 'cities', 'countries', 'is_international', 'source_url', 'evidence',
].join(', ');

/**
 * Чому запис не можна показати людині — або null, якщо можна.
 *
 * Порядок відповідей — від найгрубішого до найтоншого: спершу «поля немає»,
 * тоді «джерело не те», тоді «поле є, але ніхто його не підтвердив». Так
 * модератор бачить одну причину за раз, а не список із трьох.
 *
 * Ключі відповіді — ті самі, що читають наявні клієнти: `missing` у
 * /admin і редакторі, `problem` у редакторі, `detail` у /admin.
 */
export function publishBlockers(row) {
  if (!row) return { error: 'not_found', missing: [], problem: 'запис не знайдено', detail: 'запис не знайдено', text: 'запис не знайдено' };

  const missing = missingRequired(row);
  if (missing.length) {
    const text = `бракує: ${missing.join(', ')}`;
    return { error: 'missing_required', missing, problem: text, detail: text, text };
  }

  const bad = sourceProblem(row);
  if (bad) return { error: 'bad_source', missing: [], problem: bad, detail: bad, text: bad };

  const noProof = missingProof(row);
  if (noProof.length) {
    const text = `немає цитат зі сторінки: ${noProof.join(', ')}`;
    return { error: 'missing_proof', missing: noProof, problem: text, detail: text, text };
  }

  return null;
}
