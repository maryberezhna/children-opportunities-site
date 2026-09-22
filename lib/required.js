/**
 * Обовʼязковий мінімум перед публікацією.
 *
 * Вимога Марії 11.09.2026: дата, тип, вік, вартість і місце-або-формат
 * обовʼязкові однаково і для сайту, і для адмінки. Запис без будь-чого з
 * цього марний: батько не може вирішити, чи це для його дитини, а платформа
 * не може вчасно прибрати його з сайту.
 *
 * Самі критерії живуть в одному місці — lib/publish-criteria.json. Цей файл
 * лише читає їх; те саме робить scraper/normalizer.py. Раніше правила були
 * двома копіями (тут і в Python), і їх треба було правити руками синхронно
 * (уніфіковано 22.09.2026). Спільні приклади для обох мов —
 * tests/fixtures/publish-criteria-cases.json.
 */
import criteria from './publish-criteria.json' with { type: 'json' };

export const CRITERIA = criteria;
const R = criteria.required;

export const AGE = R.age.label;
export const DATE = R.date.label;
export const COST = R.cost.label;
export const TYPE = R.type.label;
export const PLACE = R.place.label;

// «Є значення» для поля: масив — непорожній, число 0 — значення (вік від 0),
// false і порожній рядок — порожнеча.
const present = (v) => (Array.isArray(v) ? v.length > 0 : v != null && v !== '' && v !== false);

const satisfied = (c, row) => {
  if (c.rule === 'all') return c.fields.every((f) => present(row[f]));
  if (c.rule === 'any') return c.fields.some((f) => present(row[f]));
  if (c.rule === 'in') return c.allowed.includes(row[c.fields[0]]);
  throw new Error(`publish-criteria: невідоме правило «${c.rule}»`);
};

/** Ключі критеріїв, яких бракує запису, у сталому порядку. */
export function missingRequiredKeys(row = {}) {
  return criteria.order.filter((key) => {
    const c = R[key];
    if (c.except_types && c.except_types.includes(row.opportunity_type)) return false;
    return !satisfied(c, row);
  });
}

/** Чого бракує запису, щоб його можна було показати людині (підписи). */
export function missingRequired(row = {}) {
  return missingRequiredKeys(row).map((key) => R[key].label);
}

/** Готовий рядок для повідомлення модератору. */
export function missingLabel(row) {
  const missing = missingRequired(row);
  return missing.length ? `бракує: ${missing.join(', ')}` : '';
}
