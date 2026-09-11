/**
 * Обовʼязковий мінімум перед публікацією.
 *
 * Вимога Марії 11.09.2026: дата, тип, вік, вартість і місце-або-формат
 * обовʼязкові однаково і для сайту, і для адмінки. Запис без будь-чого з
 * цього марний: батько не може вирішити, чи це для його дитини, а платформа
 * не може вчасно прибрати його з сайту. Саме так на сторінці «Дітям
 * захисників» першим записом висіла програма для дорослих жінок із
 * дедлайном місячної давнини.
 *
 * Дзеркало `missing_required()` зі `scraper/normalizer.py`. Формулювання
 * навмисно однакові до літери: модератор бачить у черзі рівно той текст,
 * який конвеєр записав у коментар.
 */

const COST_TYPES = new Set([
  'free', 'partially_free', 'paid_affordable', 'paid_premium', 'subsidized',
]);

const OPP_TYPES = new Set([
  'course', 'workshop', 'summer_school', 'mentorship', 'club', 'camp',
  'study_program', 'olympiad', 'competition', 'hackathon', 'sport_tournament',
  'festival', 'award', 'exchange', 'excursion', 'residency', 'scholarship',
  'grant', 'allowance', 'support_payment', 'internship', 'volunteer',
  'conference', 'medical_aid', 'psychology', 'rehabilitation', 'humanitarian',
  'legal_aid', 'shelter', 'educational_material',
]);

export const AGE = 'вік';
export const DATE = 'дата, період або періодичність';
export const COST = 'вартість';
export const TYPE = 'тип';
export const PLACE = 'формат або місце (онлайн / офлайн / за кордоном)';

/** Чого бракує запису, щоб його можна було показати людині. */
export function missingRequired(row = {}) {
  const missing = [];
  if (row.age_from == null || row.age_to == null) missing.push(AGE);
  if (!row.deadline && !row.event_end_date && !row.recurrence) missing.push(DATE);
  if (!COST_TYPES.has(row.cost_type)) missing.push(COST);
  if (!OPP_TYPES.has(row.opportunity_type)) missing.push(TYPE);
  // «Де» вважається відомим, якщо є формат, місто, країна або позначка
  // міжнародної: будь-що з цього відповідає батькові, куди йти дитині.
  // Порожній масив у JS істинний — звідси явна перевірка довжини.
  const hasPlace = Boolean(row.format)
    || (row.cities || []).length > 0
    || (row.countries || []).length > 0
    || Boolean(row.is_international);
  if (!hasPlace) missing.push(PLACE);
  return missing;
}

/** Готовий рядок для повідомлення модератору. */
export function missingLabel(row) {
  const missing = missingRequired(row);
  return missing.length ? `бракує: ${missing.join(', ')}` : '';
}
