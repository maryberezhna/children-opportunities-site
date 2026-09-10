/**
 * Хто бачить запис і скільки таких записів.
 *
 * Хіро головної рахувало можливості просто як `opportunities.length`, а
 * каталог під ним — за своїми правилами: без прострочених і, у режимі
 * «Підліткам», без того, що закінчується раніше 13 років. Через це підлітку
 * обіцяли 1115 можливостей, а показували 1006 (10.09.2026). Тепер обидва
 * місця рахують одним предикатом, і розійтись їм ніде.
 */

// Відносні імпорти, а не аліас @/: цей модуль читають і тести на голому
// node, де alias з jsconfig не працює.
import { daysUntil } from './dates.js';
import { ANNUAL_TYPES } from './labels.js';

/** Прострочена разова можливість. Щорічні (олімпіади тощо) не гаснуть. */
export function isLive(item, todayIso) {
  const days = daysUntil(item.deadline, todayIso);
  return !(days !== null && days < 0 && !ANNUAL_TYPES.has(item.opportunity_type));
}

/** База підліткового режиму: все, що доступне у 13+. */
export function isForTeens(item) {
  return !(item.age_to < 13);
}

/** Записи, які реально побачить людина у вибраному режимі. */
export function visibleFor(items, todayIso, teens = false) {
  return items.filter((item) => isLive(item, todayIso) && (!teens || isForTeens(item)));
}

/** Трійка цифр для хіро: скільки всього, скільки безкоштовних, скільки джерел. */
export function audienceStats(items, todayIso, teens = false) {
  const visible = visibleFor(items, todayIso, teens);
  return {
    total: visible.length,
    freeCount: visible.filter((o) => o.cost_type === 'free').length,
    sourceCount: new Set(visible.map((o) => o.source)).size,
  };
}
