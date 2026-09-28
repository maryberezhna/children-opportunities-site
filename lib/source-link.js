// Чужі Telegram-канали на сайті не показуємо НІКОЛИ (Марія, 27.09.2026:
// «ми ніколи не показуємо інші телеграм канали у першоджерелі, щоб люди не
// йшли до конкурентів»).
//
// Привід: за 30.08–26.09.2026 з карток сайту на дописи @Mozhlyvosti,
// @tviyspace і «Грантових фішок» пішло близько двохсот людей — більше, ніж
// на наш власний канал (180). У базі такий допис лишається `source_url` —
// це слід, звідки запис узявся, і він потрібен модерації. Але на сторінці
// можливості ні кнопкою, ні рядком «Джерело», ні в розмітці для пошуковиків
// він не зʼявляється. Те саме правило в Python — scraper/first_source.py
// (is_foreign_telegram), щоб такий запис не публікувався сам.

const TELEGRAM_HOSTS = ['t.me', 'telegram.me', 'telegram.dog', 'telesco.pe'];
// Наші: канал і бот Dityam+. Службовий @DityamComUABot назовні не світимо.
const OWN = new Set(['dityam_com_ua', 'dityamplusbot']);

function host(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Посилання веде в Telegram, але не в наш канал чи бот. */
export function isForeignTelegram(url) {
  if (!url) return false;
  const s = String(url).trim();
  if (/^tg:/i.test(s)) return true;
  const h = host(s);
  if (!TELEGRAM_HOSTS.some((t) => h === t || h.endsWith(`.${t}`))) return false;
  // t.me/<канал>/<id>, t.me/s/<канал>/<id>; запрошення (+хеш, joinchat)
  // невідомо чиї — теж чужі.
  const parts = new URL(s).pathname.split('/').filter(Boolean);
  const name = (parts[0] === 's' ? parts[1] : parts[0]) || '';
  return !OWN.has(name.toLowerCase());
}

// Назви каналів, які переказують чужі можливості. Коли допис уже замінено
// сторінкою організатора (first_source, 24.09.2026), у `source` лишається
// назва каналу, звідки запис прийшов, і сторінка показувала «Джерело:
// Можливості ↗» з лінком на сайт організатора — 28.09.2026 таких було 11.
// Канали самих організацій (UNICEF, House of Europe, Goethe-Institut…) сюди
// не входять: їхня назва — правда про джерело. Новий канал у
// scraper/scrapers/telegram_web.py без рішення, чий він, не пропустить тест.
export const RETELLING_CHANNELS = new Set([
  'Можливості', 'Можливості UA', 'Твій космос можливостей', 'Грантотека',
  'Грантові фішки', 'Молодь України', 'Олімпіади України', 'In Omnia Paratus',
  'United Youth', 'UniCompass', 'Нова школа', 'Освіта Нова',
]);

/** Адреса, яку можна показати людині, або null. */
export const publicLink = (url) => (url && !isForeignTelegram(url) ? url : null);

/**
 * Що зі звʼязку «джерело → подача» можна показати на сторінці можливості.
 * Коли джерело — чужий канал, ховаємо і посилання, і назву: «Джерело:
 * Можливості» — та сама реклама конкурента, лише без кліку. Назву каналу-
 * переказувача ховаємо й тоді, коли посилання вже веде до організатора.
 */
export function publicSource(item) {
  const sourceUrl = publicLink(item?.source_url);
  const foreignSource = isForeignTelegram(item?.source_url);
  const apply = publicLink(item?.apply_url);
  const hideName = foreignSource || RETELLING_CHANNELS.has(String(item?.source || '').trim());
  return {
    sourceUrl,
    sourceName: hideName ? null : (item?.source || null),
    applyUrl: apply && apply !== sourceUrl ? apply : null,
    // Куди веде головна кнопка: подача, якщо відома, інакше джерело.
    primaryUrl: apply || sourceUrl,
  };
}
