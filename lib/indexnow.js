/**
 * IndexNow — сказати пошуковику про нову сторінку, не чекаючи обходу.
 *
 * Навіщо (Марія, 05.10.2026: «як ростити присутність в AI»). ChatGPT, шукаючи
 * в інтернеті, спирається на індекс Bing. Тобто шлях до AI-видимості лежить
 * не через нові сторінки, а через те, ЯК ШВИДКО Bing дізнається про наявні:
 * можливість із дедлайном за два тижні не має сенсу, якщо її проіндексують
 * через місяць.
 *
 * IndexNow — відкритий протокол: публікуємо на сайті файл-ключ і надсилаємо
 * адреси. Перевірки сайту у Bing для цього не треба — достатньо ключа.
 *
 * ЧОМУ НЕ СПІЛЬНИЙ ЕНДПОІНТ. api.indexnow.org роздає адреси всім учасникам
 * протоколу, зокрема Яндексу. 02.10.2026 ми свідомо закрили сайт від пошуку
 * рф і білорусі — було б дивно після цього самим надсилати їм свої сторінки.
 * Тому шлемо напряму у Bing.
 */
export const INDEXNOW_KEY = '80b6929559aba47df86c8b91bcad1e24';
export const INDEXNOW_ENDPOINT = 'https://www.bing.com/indexnow';
export const SITE = 'https://dityam.com.ua';

/** За раз протокол приймає до 10 000 адрес. */
export const MAX_URLS = 10000;

/** Тіло запиту. Чиста функція — під тести. */
export function indexNowBody(urls, { host = 'dityam.com.ua', key = INDEXNOW_KEY } = {}) {
  const list = [...new Set(urls)].filter((u) => typeof u === 'string' && u.startsWith(`${SITE}/`));
  if (!list.length) throw new Error('немає жодної адреси нашого сайту');
  if (list.length > MAX_URLS) throw new Error(`за раз не більше ${MAX_URLS} адрес`);
  return {
    host,
    key,
    keyLocation: `${SITE}/${key}.txt`,
    urlList: list,
  };
}
