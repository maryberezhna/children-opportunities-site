/**
 * Заголовок і тип структурованих даних сторінки можливості.
 *
 * Привід — аудит Semrush 02.10.2026 (100 сторінок): 72 заголовки задовгі,
 * 43 блоки структурованих даних невалідні. Обидва правила лежать тут, а не в
 * app/o/shared.js, щоб їх можна було тестувати: той файл тягне стилі й
 * компоненти, і node --test його не завантажить.
 */

/** Google показує близько 60 символів заголовка; далі обрізає трьома крапками. */
export const TITLE_MAX = 65;

/**
 * Заголовок сторінки можливості — без назви сайту наприкінці.
 *
 * Було «{назва} — {тип} для дітей {вік} | Можливості для дитини»: медіана
 * 100 символів, найдовший 170. Назву сайту Google і так показує окремим
 * рядком над заголовком, а в самому заголовку вона зʼїдала 24 символи.
 *
 * Саму назву не скорочуємо ніколи: це власна назва програми. Скорочуємо
 * лише те, що дописали ми, — у три кроки, поки не вміститься.
 */
export function opportunityTitle({ name, typeLabel, ageRange, lang = 'uk' }) {
  const clean = String(name || '').trim();
  if (!typeLabel || !ageRange) return clean;
  const full = lang === 'en'
    ? `${clean} — ${typeLabel} for children ${ageRange}`
    : `${clean} — ${typeLabel} для дітей ${ageRange}`;
  if (full.length <= TITLE_MAX) return full;
  const short = `${clean} — ${typeLabel}, ${ageRange}`;
  if (short.length <= TITLE_MAX) return short;
  return clean;
}

// Заняття, на які дитина записується: курс чи гурток.
const SERVICE_TYPES = new Set(['course', 'club']);
// Те, що відбувається в певні дні. Олімпіада раніше йшла як «Course».
const EVENT_TYPES = new Set(['camp', 'festival', 'sport_event', 'competition', 'olympiad']);

/**
 * Який тип schema.org віддає сторінка: 'Service', 'Event' або 'WebPage'.
 *
 * До 02.10.2026 курс, гурток, олімпіада, обмін, стипендія і стажування
 * йшли як Course. Google вимагає для Course розклад занять
 * (hasCourseInstance з courseWorkload або courseSchedule) і ціну з
 * категорією — тривалості занять у базі немає, а вигадувати її не можна.
 * Тож усі 50 таких сторінок із 50 перевірених були невалідні, і розширеного
 * вигляду в пошуку не давала жодна. До того ж олімпіада чи стипендія — не
 * курс за змістом.
 *
 * Тепер кажемо лише те, що знаємо:
 *   курс і гурток — Service: хто проводить, для якого віку, де, чи безкоштовно;
 *   подія з відомою датою проведення — Event;
 *   решта — WebPage.
 */
export function structuredType(item) {
  const type = item?.opportunity_type;
  if (SERVICE_TYPES.has(type)) return 'Service';
  if (EVENT_TYPES.has(type) && item?.event_start_date) return 'Event';
  return 'WebPage';
}

/** Вік як PeopleAudience — лише коли обидві межі відомі. */
export function audienceOf(item) {
  const from = item?.age_from;
  const to = item?.age_to;
  if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
  return { '@type': 'PeopleAudience', suggestedMinAge: from, suggestedMaxAge: to };
}
