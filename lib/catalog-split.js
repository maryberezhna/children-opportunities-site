/**
 * Головна без важкого HTML: тексти карток поза першим екраном їдуть окремо.
 *
 * Марія, 07.10.2026: «швидкість понад усе». Головна віддавала в HTML усі ~730
 * записів повністю (244 КБ стиснено проти 46 КБ у підбірки), і на повільному
 * мобільному інтернеті саме ця різниця тримала основний текст до 5,5 с
 * (Lighthouse). Обчислення списку при цьому брали лише ~130 мс.
 *
 * Тепер кожен запис їде «легким»: усе, що потрібно фільтрам, лічильникам,
 * сортуванню й групі олімпіад МОН (тип, вік, вартість, дати, місця, назва),
 * — але без текстів картки (опис, slug, джерело, підліткові поля, англійська
 * назва). Повністю їдуть лише ті, чию картку можуть побачити до довантаження:
 *   • перші KEEP у типовому порядку списку — для батьків і для підлітків;
 *   • усе з дедлайном у найближчі 31 день — це й кандидати «Топ 3 цього
 *     тижня» (weekly-top рахує бал і за довжину опису), і фільтр «цього
 *     місяця»;
 *   • відмічені в адмінці на тиждень (featured_week) і олімпіади МОН (їхня
 *     група показує чипи предметів зі slug).
 * Решту текстів список довантажує з /api/catalog/<мова> одразу після показу
 * сторінки (app/OpportunitiesList.js, detailsUrl).
 */
import { visibleFor } from './audience.js';
import { whenRank } from './timing.js';
import { daysUntil } from './dates.js';
import { isMonOlympiad } from './olympiads.js';
import { ONLINE_RE } from './online.js';

/** Поля, яких легкий запис не має. Їх віддає /api/catalog/<мова>. */
export const DETAIL_FIELDS = [
  'slug', 'summary', 'summary_en', 'title_en', 'source', 'source_url', 'teen_benefit', 'teen_requirement',
];

/** Скільки записів кожного режиму їде повністю. На екрані — 40 карток; запас
 *  на групу олімпіад, яка з'їдає кілька записів за одну картку, і на дорізку
 *  останнього рядка сітки. */
export const KEEP = 80;

export const detailsUrl = (lang = 'uk') => `/api/catalog/${lang === 'en' ? 'en' : 'uk'}`;

/** Типовий порядок списку: найближча дата вгорі, без дат — свіжіші перші.
 *  Те саме, що сортування в OpportunitiesList без пошуку й закріплених. */
export const defaultOrder = (todayIso) => {
  const rank = (o) => Math.min(whenRank(o, todayIso), 9999);
  return (a, b) => (rank(a) - rank(b)) || (b.created_at || '').localeCompare(a.created_at || '');
};

/** Хто з записів їде повністю. */
export function keepIds(rows, todayIso, keep = KEEP) {
  const ids = new Set();
  for (const teens of [false, true]) {
    [...visibleFor(rows, todayIso, teens)].sort(defaultOrder(todayIso)).slice(0, keep)
      .forEach((o) => ids.add(o.id));
  }
  for (const o of rows) {
    const d = daysUntil(o.deadline, todayIso);
    if ((d !== null && d >= 0 && d <= 31) || o.featured_week || isMonOlympiad(o)) ids.add(o.id);
  }
  return ids;
}

/** Записи для браузера: повні для keepIds, решта — без DETAIL_FIELDS. */
export function lightCatalog(rows = [], { todayIso, keep = KEEP } = {}) {
  const full = keepIds(rows, todayIso, keep);
  return rows.map((o) => {
    if (full.has(o.id)) return o;
    const out = { ...o };
    // «Онлайн» буває сказано лише в описі — опис не їде, позначка їде.
    if (ONLINE_RE.test(o.summary || '')) out.online_text = true;
    for (const k of DETAIL_FIELDS) delete out[k];
    return out;
  });
}
