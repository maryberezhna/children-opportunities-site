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

// Виняток «вартість уточнюйте в школі» (Марія, 28.09.2026) — лише для шкіл і
// студій діаспори. Визначення в publish-criteria.json (required.cost.ask_school);
// те саме читає scraper/proof.py (ask_school_ok).
const ASK = R.cost.ask_school;
const ASK_TITLE = new RegExp(ASK.title_pattern, 'i');
export const ASK_SCHOOL = ASK.value;

/** Чи запис — школа чи студія діаспори: тип зі списку, слово «школа» /
 * «студія» / «центр» у назві, усі країни поза Україною. */
export function isDiasporaSchool(row = {}) {
  if (!ASK.types.includes(row.opportunity_type)) return false;
  if (!ASK_TITLE.test(row.title || '')) return false;
  const countries = (row.countries || []).map((c) => String(c).toLowerCase()).filter(Boolean);
  return countries.length > 0 && !countries.includes('ua');
}

/** «Вартість уточнюйте в школі» стоїть і дозволена саме цьому запису. */
export const askSchoolCost = (row = {}) => row.cost_type === ASK.value && isDiasporaSchool(row);

// Джерела, де ціни немає й не буде: сторінка гуртка палацу позашкілля — це
// опис занять, а не прайс (рішення Марії 02.10.2026, той самий виняток, що для
// шкіл діаспори). Значення вартості лишається як є — не вимагаємо лише цитати.
// Пари «хост → свої типи», а не два незалежні списки: інакше кожен новий хост
// звільняв би й чужі типи (02.10.2026 Дія.Освіта почала звільняти гуртки).
const NO_QUOTE = (R.cost.no_quote_sources || {}).pairs || [];
export function costQuoteImpossible(row = {}) {
  const url = String(row.source_url || '').toLowerCase();
  if (!url) return false;
  return NO_QUOTE.some(
    (p) => url.includes(p.host) && (p.types || []).includes(row.opportunity_type),
  );
}

const satisfied = (c, row) => {
  if (c === R.cost && askSchoolCost(row)) return true;
  if (c.rule === 'all') return c.fields.every((f) => present(row[f]));
  if (c.rule === 'any') {
    if (c.fields.some((f) => present(row[f]))) return true;
    // Поле зі списком значень: не «є щось», а «є саме це». Так періодичність
    // рахується з timing_kind, а не лише з дат (01.10.2026).
    return Object.entries(c.any_values || {}).some(([f, vals]) => vals.includes(row[f]));
  }
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

// «Є цитата» — непорожній рядок під ключем критерію в row.evidence.
const hasQuote = (ev, key) => typeof ev?.[key] === 'string' && ev[key].trim().length > 0;

/** Ключі обовʼязкових полів без дослівної цитати зі сторінки (світлофор,
 * 22.09.2026). Виняток для виплат той самий, що й у missingRequiredKeys. */
export function missingProofKeys(row = {}) {
  const ev = row.evidence && typeof row.evidence === 'object' ? row.evidence : {};
  return criteria.order.filter((key) => {
    const c = R[key];
    if (c.except_types && c.except_types.includes(row.opportunity_type)) return false;
    // Ціни на сторінці немає — цитувати нема чого (виняток для шкіл діаспори).
    if (key === 'cost' && (askSchoolCost(row) || costQuoteImpossible(row))) return false;
    return !hasQuote(ev, key);
  });
}

/** Підписи полів без цитати. */
export function missingProof(row = {}) {
  return missingProofKeys(row).map((key) => R[key].label);
}
