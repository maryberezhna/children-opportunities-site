/**
 * Логіка перемикання «Топ тижня» — без React, щоб її перевіряв тест.
 *
 * Марія, 04.10.2026: «заміни це на гарну карточку = 1 можливість, яка
 * слайдером міняється; 1 можливість яку чітко видно, і наступні 2 одразу
 * змінюються — бо ми це продаємо, а зараз це тупо».
 *
 * Було три дрібні рядки один під одним: жоден не читався як пропозиція, і
 * показати таке організаторові за гроші соромно. Стало — одна велика картка
 * на весь блок, що по черзі показує кожну з трьох.
 */

/** Скільки показувати одну картку, мс. Досить, щоб прочитати назву. */
export const SLIDE_MS = 6000;

/** Наступний індекс по колу. */
export const nextIndex = (i, total) => (total > 0 ? (i + 1) % total : 0);

/** Попередній — для стрілки й свайпу назад. */
export const prevIndex = (i, total) => (total > 0 ? (i - 1 + total) % total : 0);

/**
 * Чи крутити самим.
 *
 * Не крутимо, коли: картка одна; людина навела мишу чи тримає фокус (інакше
 * вона не встигне дочитати чи натиснути); людина вже перемкнула вручну —
 * далі вирішує вона, а не таймер; система просить менше руху.
 *
 * Останнє не косметика: автокарусель, яка не спиняється, — класична проблема
 * доступності (WCAG 2.2.2), і для людини з вестибулярним розладом вона
 * робить сторінку непридатною.
 */
export function shouldAutoPlay({ total, paused, touched, reducedMotion }) {
  if (total < 2) return false;
  if (paused || touched || reducedMotion) return false;
  return true;
}

/**
 * Куди веде свайп. Поріг у 40px: менше — це тремтіння пальця під час
 * вертикальної прокрутки, і картка стрибала б сама.
 */
export function swipeTo(startX, endX, current, total, threshold = 40) {
  const dx = endX - startX;
  if (Math.abs(dx) < threshold) return current;
  return dx < 0 ? nextIndex(current, total) : prevIndex(current, total);
}

// ── Готові картки для слайдера ───────────────────────────────────────────────
//
// Блок стоїть і на головній, і в кожній підбірці. Збирати картку в кожному
// місці окремо означало б, що підписи колись розійдуться — а це те, що ми
// продаємо. Тому одна функція на обох.

const MONTHS = {
  uk: ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** День і місяць із ISO-дати, або null, якщо дати немає. */
export function dateParts(iso, lang = 'uk') {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  return { day: Number(m[3]), month: (MONTHS[lang] || MONTHS.uk)[Number(m[2]) - 1] };
}

/**
 * Рядки можливостей → картки слайдера.
 *
 * labels: { pinned, free, type: {код: підпис}, age: (row) => рядок }.
 * Підписи приходять ззовні, бо вони різні на головній і в підбірці лише мовою,
 * а словники типів і віку вже живуть у lib/labels.js.
 */
export function sliderCards(rows = [], { lang = 'uk', pinned, free, type = {}, age } = {}) {
  const isEn = lang === 'en';
  return rows.map((o) => {
    const d = dateParts(o.deadline, lang);
    return {
      slug: o.slug,
      // Власна сторінка (олімпіада) — пряме посилання замість /o/<slug>.
      href: o.href || null,
      title: (isEn && o.title_en) || o.title,
      // Назва лишилась українською на англійській сторінці — щоб картка могла
      // поставити lang="uk" і синтезатор мови не читав її як англійську.
      titleIsUk: isEn && !o.title_en,
      day: d ? d.day : null,
      month: d ? d.month : null,
      dateLabel: d ? null : (o.label || pinned),
      meta: [
        type[o.opportunity_type] || null,
        age ? age(o) : null,
        o.cost_type === 'free' ? free : null,
      ].filter(Boolean).join(' · '),
    };
  });
}
