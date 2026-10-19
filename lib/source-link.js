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

// Що не буває джерелом, коли людина вставляє адресу руками (28.09.2026). Ті
// самі правила, що й у scraper/first_source.py, — коротким переліком, з
// одним винятком: форму організатора людина джерелом зробити може (Марія,
// 29.09.2026: «має бути можна» — «МініВсесвіт» Ноосфери, у якого, крім
// форми з датами, є лише Facebook). Автоматичний пошук першоджерела форму
// й далі не бере: без людини вона підмінила б допис порожньою сторінкою.
const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 'fb.com', 'fb.me', 'tiktok.com', 'x.com',
  'twitter.com', 'linkedin.com', 'viber.com', 'chat.whatsapp.com', 'wa.me', 'discord.gg'];
const FORM_HOSTS = ['forms.gle', 'forms.office.com', 'typeform.com', 'jotform.com', 'surveymonkey.com', 'airtable.com'];
const DOC_HOSTS = ['drive.google.com', 'youtube.com', 'youtu.be', 'vimeo.com'];
const onHost = (h, list) => list.some((t) => h === t || h.endsWith(`.${t}`));

/**
 * Сайт, яким користуються всі підряд, а не один організатор: Google-документ,
 * форма, диск, відео, соцмережа чи Telegram. Брати такий «на моніторинг»
 * нема сенсу — сторінка однієї форми нічого не каже про інші. 19.10.2026
 * черга пропонувала взяти docs.google.com: сервер і так відмовляв, але
 * пропозиція в очі виглядала як помилка.
 */
export function isSharedHost(url) {
  const h = host(url);
  if (!h) return true;
  return h === 'docs.google.com'
    || onHost(h, TELEGRAM_HOSTS) || onHost(h, SOCIAL_HOSTS)
    || onHost(h, FORM_HOSTS) || onHost(h, DOC_HOSTS);
}

// Невидимі символи, які приїжджають разом зі вставленим текстом: zero-width,
// позначки напряму письма, BOM, мʼякий перенос. Око їх не бачить, а
// /^https?:\/\// на них спотикається.
const INVISIBLE = /[​-‏⁠﻿­]/g;

/**
 * Адреса з того, що людина вставила в поле, або '' якщо адреси там немає.
 *
 * 16.10.2026, Марія: «не правда — це не адреса сторінки, має починатися з
 * https://» на цілком нормальне посилання. Вона копіювала його з
 * Telegram-допису («🔵 Зареєструватися до 16 жовтня»), а разом із ним
 * причепився невидимий символ. Форма відмовляла, і можливість (воркшоп
 * Design Lab «Ліги Сильних», реєстрація до того ж дня) не потрапила в базу
 * взагалі. Тому тепер поле саме дістає адресу з того, що вставили: прибирає
 * невидиме, знімає лапки й дужки, бере перше https-посилання з тексту і
 * дописує схему домену, написаному без неї.
 */
export function cleanSourceUrl(input) {
  let s = String(input || '').replace(INVISIBLE, '').trim();
  if (!s) return '';
  // «Реєстрація: https://… до 16 жовтня» — беремо саме адресу.
  const found = s.match(/https?:\/\/\S+/i);
  if (found) s = found[0];
  s = s.replace(/^[«"'(<[]+/, '').replace(/[»"')>\].,;!?]+$/, '');
  if (!/^https?:\/\//i.test(s)) {
    // «ls.org.ua/novyny/…» — адреса без схеми. Просто текст — ні.
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]|$)/i.test(s)) return '';
    s = `https://${s}`;
  }
  try {
    if (!new URL(s).hostname.includes('.')) return '';
  } catch {
    return '';
  }
  return s;
}

/** Чому адресу не можна зробити джерелом, або null, якщо можна. */
export function sourceUrlProblem(url) {
  const s = cleanSourceUrl(url);
  if (!s) return 'Це не адреса сторінки — має починатися з https://';
  const h = host(s);
  if (!h) return 'Це не адреса сторінки';
  if (TELEGRAM_HOSTS.some((t) => h === t || h.endsWith(`.${t}`))) {
    return 'Telegram-канал не буває джерелом — потрібна сторінка організатора';
  }
  if (onHost(h, SOCIAL_HOSTS)) return 'Соцмережа не буває джерелом — потрібна сторінка організатора';
  const path = (() => { try { return new URL(s).pathname; } catch { return ''; } })();
  if (onHost(h, FORM_HOSTS) || (h === 'docs.google.com' && /\/forms?\//.test(path))) return null;
  if (onHost(h, DOC_HOSTS) || h === 'docs.google.com') {
    return 'Документ чи відео — не джерело: потрібна сторінка організатора';
  }
  return null;
}

// Службові підписи походження, які колись потрапляли в `source` і виходили
// на сторінку в рядку «Організатор». Марія, 19.10.2026: «Пропозиція від
// організатора не пишемо НІКОЛИ — просто назву і посилання». Конвеєр так
// більше не підписує (scraper/process_suggestions.py), але такі рядки могли
// лишитись у старих записах і в кеші — тож назву підміняє домен сторінки,
// на яку веде це саме посилання.
const ORIGIN_LABELS = new Set([
  'пропозиція від організатора',
  'пропозиція з форми',
  'пропозиція з форми на сайті',
  'форма на сайті',
]);

/** Назва організатора для сторінки: ніколи не службовий підпис походження. */
function displayName(name, url) {
  const clean = String(name || '').trim();
  if (!clean) return null;
  if (!ORIGIN_LABELS.has(clean.toLowerCase())) return clean;
  return host(url) || null;
}

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
    sourceName: hideName ? null : displayName(item?.source, sourceUrl),
    applyUrl: apply && apply !== sourceUrl ? apply : null,
    // Куди веде головна кнопка: подача, якщо відома, інакше джерело.
    primaryUrl: apply || sourceUrl,
  };
}
