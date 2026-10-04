/**
 * Що запис мусить мати перед публікацією — і що просто заповнюємо.
 *
 * 11.09.2026 обовʼязковими були пʼять полів: дата, тип, вік, вартість і
 * місце-або-формат. 03.10.2026 Марія це скасувала: «обовʼязкові поля — тільки
 * дата початку програми і дедлайн для деяких типів… заповнюємо максимум
 * полів, але якщо якогось не вистачає, це не має затримувати чергу». Тепер
 * публікацію тримає лише `blocking` (дата для програм із датами); решта
 * полів — те, що ми заповнюємо, скільки знайдемо.
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
  if (c.rule === 'any') return c.fields.some((f) => present(row[f]));
  if (c.rule === 'in') return c.allowed.includes(row[c.fields[0]]);
  throw new Error(`publish-criteria: невідоме правило «${c.rule}»`);
};

/**
 * Чи потрібна запису дата (03.10.2026). Програмам із датами — так:
 * одноразовим і періодичним за видом у часі, а коли вид невідомий — за типом.
 * Постійним (гурток, суботня школа, платформа з вільним записом) — ні.
 */
export function needsDate(row = {}) {
  const c = R.date;
  if (c.except_types && c.except_types.includes(row.opportunity_type)) return false;
  if (row.timing_kind) return c.kinds.includes(row.timing_kind);
  return c.types_when_kind_unknown.includes(row.opportunity_type);
}

const applies = (key, row) => {
  if (key === 'date') return needsDate(row);
  const c = R[key];
  return !(c.except_types && c.except_types.includes(row.opportunity_type));
};

/** Ключі того, без чого запис не йде на сайт, у сталому порядку. */
export function missingRequiredKeys(row = {}) {
  return criteria.order.filter(
    (key) => criteria.blocking.includes(key) && applies(key, row) && !satisfied(R[key], row),
  );
}

/** Поля, які варто дозаповнити (усі пʼять), — підказка, а не ворота. */
export function missingFieldKeys(row = {}) {
  return criteria.order.filter((key) => applies(key, row) && !satisfied(R[key], row));
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
