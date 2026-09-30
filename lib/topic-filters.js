// Фільтри й лічильники сторінки підбірки (редизайн, PR 3, 29.09.2026).
// Без React — щоб читалось тестами на голому node, як решта lib/.
//
// Вік — ті самі пʼять груп, що на головній (AGE_OPTS у app/OpportunitiesList.js),
// а не чотири з макета: так збігаються ?age= у посиланнях, шторка й сайдбар
// (рішення Марії 29.09.2026). Правило збігу — теж те саме: діапазони
// перетинаються.
import { daysUntil } from './dates.js';
import { isOnline } from './geo.js';

// [значення, підпис uk, підпис en]. Слово «роки» в самій пігулці: на
// телефоні рядок фільтрів гортається, підпис «Вік» ховається, і «0–3» поруч
// із «Конкурси» ні про що не казав (Марія, 30.09.2026).
export const AGE_GROUPS = [
  ['0-3', '0–3 роки', 'ages 0–3'], ['4-6', '4–6 років', 'ages 4–6'], ['7-11', '7–11 років', 'ages 7–11'],
  ['12-14', '12–14 років', 'ages 12–14'], ['15-17', '15–17 років', 'ages 15–17'],
];

export function ageMatches(item, value) {
  const [from, to] = String(value || '').split('-').map(Number);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return true;
  return item.age_from <= to && item.age_to >= from;
}

/** Скільки записів закриваються протягом семи днів (дедлайн від сьогодні до +7). */
export function closingThisWeek(items, todayIso) {
  return (items || []).filter((o) => {
    const d = daysUntil(o?.deadline, todayIso);
    return d !== null && d >= 0 && d <= 7;
  }).length;
}

/**
 * Записи, що проходять фільтри рядка над списком:
 *   types  — типи обраної вкладки (null — усі);
 *   age    — група віку ('7-11') або null;
 *   free   — лише безкоштовні;
 *   online — лише дистанційні (lib/geo.js).
 */
export function applyTopicFilters(items, { types = null, age = null, free = false, online = false } = {}) {
  return (items || []).filter((o) => (
    (!types || types.includes(o.opportunity_type))
    && (!age || ageMatches(o, age))
    && (!free || o.cost_type === 'free')
    && (!online || isOnline(o))
  ));
}

/**
 * Перше речення тексту й решта. У hero підбірки — один рядок опису (макет
 * Topic.dc.html), а повний текст іде в «Важливо знати», щоб нічого не
 * зникало зі сторінки: інтро цитують асистенти.
 */
export function splitIntro(text) {
  const s = String(text || '').trim();
  if (!s) return { first: '', rest: '' };
  const m = /^(.+?[.!?»])(?:\s+|$)([\s\S]*)$/.exec(s);
  if (!m) return { first: s, rest: '' };
  return { first: m[1].trim(), rest: m[2].trim() };
}
