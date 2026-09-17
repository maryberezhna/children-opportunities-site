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
import { isExpired } from './timing.js';

/**
 * Чи показувати запис у списках.
 *
 * До 17.09.2026 щорічні типи (олімпіади, конкурси, гранти…) не гасли після
 * дедлайну — висіли в списках «🔄 щорічно», хоч подати було вже не можна.
 * Рішення Марії «Б»: між сезонами періодична програма зникає зі списків, а
 * сторінка лишається для пошуку. Тож минуле ховається для будь-якого виду —
 * рівно те, що планова перевірка (scraper/lifecycle.py) закриє вночі.
 */
export function isLive(item, todayIso) {
  return !isExpired(item, todayIso);
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
