/**
 * Картки «Топ 3 цього тижня» — без React, щоб їх перевіряв тест.
 *
 * Марія, 04.10.2026: «1 можливість яку чітко видно… бо ми це продаємо, а
 * зараз це тупо». Було три дрібні рядки один під одним: жоден не читався як
 * пропозиція, і показати таке організаторові за гроші соромно.
 *
 * Ім'я файлу лишилось від каруселі (04–07.10.2026). 07.10 Марія обрала
 * замість неї рейтинг із цифрами 1, 2, 3 (app/TopWeekSlider.js), і логіка
 * перемикання звідси пішла; лишилось те, що збирає картку з рядка бази.
 */

// ── Готові картки для слайдера ───────────────────────────────────────────────
//
// Блок стоїть і на головній, і в кожній підбірці. Збирати картку в кожному
// місці окремо означало б, що підписи колись розійдуться — а це те, що ми
// продаємо. Тому одна функція на обох.

import { organiserBadge, formatPlace } from './card-facts.js';

const MONTHS = {
  uk: ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Скільки днів лишилось до дедлайну; null, якщо дати чи «сьогодні» немає. */
function daysLeftOf(deadline, todayIso) {
  if (!deadline || !todayIso) return null;
  const a = Date.parse(`${String(deadline).slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${String(todayIso).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

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
export function sliderCards(rows = [], { lang = 'uk', pinned, free, type = {}, age, todayIso = null } = {}) {
  const isEn = lang === 'en';
  return rows.map((o) => {
    const d = dateParts(o.deadline, lang);
    // Широкий розклад підбірки показує те саме, що й картка каталогу:
    // пігулки, організатора під назвою, дедлайн і формат (Марія, 19.10.2026:
    // «вони відповідають за монетизацію… мають виділятися і приковувати
    // погляд»). Вузький розклад головної цих полів не читає.
    const chips = [
      type[o.opportunity_type] ? { kind: 'type', text: type[o.opportunity_type] } : null,
      age && age(o) ? { kind: 'age', text: age(o) } : null,
      o.cost_type === 'free' && free ? { kind: 'free', text: free } : null,
    ].filter(Boolean);
    return {
      chips,
      org: organiserBadge(o, lang),
      where: formatPlace(o, lang) || null,
      daysLeft: daysLeftOf(o.deadline, todayIso),
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
        // Що дитина отримає — лише в наших власних карток (OLIMP_TOP.perk).
        o.perk || null,
      ].filter(Boolean).join(' · '),
    };
  });
}
