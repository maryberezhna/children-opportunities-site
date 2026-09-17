/**
 * Що сказати людині про час можливості — одне місце для всього сайту.
 *
 * До 17.09.2026 картка списку, картка тематичної сторінки, сортування і
 * перевірка «чи живий запис» рахували час кожна по-своєму і дивились лише на
 * дедлайн, а вид вгадували за типом (ANNUAL_TYPES). Наслідки з аудиту
 * «Дедлайн, подія, сезон»:
 *   • подія без дедлайну показувалась як «набір відкритий», хоч дата є;
 *   • для подій значок рахував дні від ДЕДЛАЙНУ спокійним кольором — подача,
 *     що закривається, виглядала як далека подія;
 *   • конкурс, що не повториться, підписувався «🔄 щорічно».
 *
 * Тепер час читається з полів: deadline — лише подача; event_start_date /
 * event_end_date — проведення; timing_kind — вид, прочитаний із тексту
 * (одноразова / періодична / постійна). Тип — лише запасна підказка, доки
 * вид не визначено.
 *
 * Дзеркало is_expired зі scraper/timing.py: сайт ховає рівно те, що
 * планова перевірка закриє вночі.
 */
import { daysUntil } from './dates.js';
import { ANNUAL_TYPES } from './labels.js';

/** Періодична: за видом із тексту, а поки вид невідомий — за типом. */
export function isPeriodic(item) {
  if (item?.timing_kind) return item.timing_kind === 'periodic';
  return ANNUAL_TYPES.has(item?.opportunity_type);
}

/**
 * Чи минула можливість: подати вже не можна або подія вже відбулась.
 * Дата початку закриває запис лише без дедлайну й без кінця події.
 */
export function isExpired(item, todayIso) {
  const dl = daysUntil(item?.deadline, todayIso);
  const end = daysUntil(item?.event_end_date, todayIso);
  const start = daysUntil(item?.event_start_date, todayIso);
  if (dl !== null && dl < 0) return true;
  if (end !== null && end < 0) return true;
  if (dl === null && end === null && start !== null && start < 0) return true;
  return false;
}

/**
 * Стан часу для картки. Мовно-нейтральний: текст складає компонент.
 *
 *   { state: 'deadline', days }     — подача відкрита, до дедлайну days днів
 *   { state: 'event', days, date }  — подія попереду (days до початку)
 *   { state: 'running', days }      — подія триває, до кінця days днів
 *   { state: 'periodic' }           — щороку, дат цього сезону не видно
 *   { state: 'permanent' }          — записатися можна будь-коли
 *   { state: 'open' }               — дат немає, вид не каже більше
 */
export function whenState(item, todayIso) {
  const dl = daysUntil(item?.deadline, todayIso);
  if (dl !== null && dl >= 0) return { state: 'deadline', days: dl };

  const start = daysUntil(item?.event_start_date, todayIso);
  const end = daysUntil(item?.event_end_date ?? item?.event_start_date, todayIso);
  if (end !== null && end >= 0) {
    if (start !== null && start > 0) {
      return { state: 'event', days: start, date: item.event_start_date };
    }
    if (start === null && item?.event_end_date && end > 0) {
      // Відомий лише кінець — показуємо саме його, а не вигадуємо початок.
      return { state: 'event', days: end, date: item.event_end_date };
    }
    return { state: 'running', days: end };
  }

  if (item?.timing_kind === 'permanent') return { state: 'permanent' };
  if (isPeriodic(item)) return { state: 'periodic' };
  return { state: 'open' };
}

/**
 * Ключ сортування «що найближче»: дні до дедлайну, а без нього — до початку
 * чи кінця події. Без жодної майбутньої дати — у кінець списку.
 */
export function whenRank(item, todayIso) {
  const s = whenState(item, todayIso);
  if (s.state === 'deadline' || s.state === 'event' || s.state === 'running') return s.days;
  return Number.POSITIVE_INFINITY;
}
