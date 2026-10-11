/**
 * Яке джерело можна показувати людині.
 *
 * Правило Марії 27.09.2026: чужий Telegram-канал ми не показуємо ніколи — ні
 * кнопкою, ні підписом «Джерело». Допис у чужому каналі — це переказ: він
 * зникає, його не можна процитувати як сторінку організатора, і людина, яка
 * туди переходить, опиняється в чужому каналі замість організатора.
 *
 * Правило було, масовий прохід 28.09.2026 прибрав 125 записів — а перевірки в
 * коді не існувало. Тому 01.10.2026 на сайті знову висіли три такі записи.
 */

import { isForeignTelegram as hiddenOnPage, publicSource } from './source-link.js';
import criteria from './publish-criteria.json' with { type: 'json' };

/** Наш власний канал — не джерело можливості, але й не порушення. */
const OURS = /t\.me\/(dityam_com_ua|DityamPlusBot)\b/i;

/**
 * Чи веде адреса в чужий Telegram.
 *
 * Ворота мусять бачити все, що сторінка ховає (source-link.js): до 09.10.2026
 * тут був лише t.me/telegram.me, а сторінка ховала ще telegram.dog, telesco.pe,
 * tg: і службового бота — такий запис проходив ворота й висів без посилання.
 * Власний регулярний вираз лишається для адрес без https://.
 */
export function isForeignTelegram(url) {
  const u = String(url || '');
  if (hiddenOnPage(u)) return true;
  if (!/(^|\/\/)(t\.me|telegram\.me)\//i.test(u)) return false;
  return !OURS.test(u);
}

// Каталог чужих можливостей — не першоджерело: сторінка програми в Eurodesk
// переказує організатора. Масовий прохід 28.09.2026 закрив такі записи разом
// із дописами каналів. Дзеркало is_catalog у scraper/first_source.py.
const CATALOG = /(^|\/\/|\.)eurodesk\.eu(\/|$)/i;

/** Чи веде адреса в каталог, а не до організатора. */
export function isCatalog(url) {
  return CATALOG.test(String(url || ''));
}

// Медіа й агрегатори (Марія, 11.10.2026): «анонс чогось у медіа — це не
// можливість, а знахідка; треба йти на першоджерело». Список спільний із
// scraper/first_source.py — lib/publish-criteria.json.
const NOT_PRIMARY = criteria.not_primary_hosts?.hosts || [];

const hostOf = (url) => {
  try {
    return new URL(String(url || '')).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Чи веде адреса в медіа чи агрегатор, а не до організатора. */
export function isRetellingSite(url) {
  const host = hostOf(url);
  return Boolean(host) && NOT_PRIMARY.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Чому запис не можна показувати — або '' , якщо можна.
 * Окремою функцією, щоб обидва шляхи публікації казали те саме.
 */
export function sourceProblem(row = {}) {
  if (isForeignTelegram(row.source_url)) {
    return 'джерело — чужий Telegram-канал; потрібна сторінка організатора';
  }
  if (isCatalog(row.source_url)) {
    return 'джерело — каталог Eurodesk; потрібна сторінка організатора';
  }
  if (isRetellingSite(row.source_url)) {
    return `джерело — медіа чи агрегатор (${hostOf(row.source_url)}): це знахідка, потрібна сторінка організатора, форма чи контакт`;
  }
  // Посилання обовʼязкове (Марія, 09.10.2026: «як божий день»). Порожнє
  // джерело проходило всі ворота, а сторінка без жодного посилання — це
  // звернення «хочу подати, а лінку нема» (HERside, 09.10.2026).
  if (!publicSource(row).primaryUrl) {
    return 'немає посилання: ні сторінки організатора, ні форми подачі';
  }
  return '';
}
