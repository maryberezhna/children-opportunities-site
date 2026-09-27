// Захист від масового копіювання можливостей (Марія, 27.09.2026: «можеш
// написати захист сайту, щоб наші можливості не вкрали»).
//
// Повністю закрити публічні сторінки неможливо й не треба: 58% людей
// приходять із Google, третє джерело — ChatGPT, і обидва читають сайт роботами.
// Тому правило вузьке: відсікаємо те, чим копіюють сайти пачками, — HTTP-
// бібліотеки (Python, Go, Java, Node), wget і збирачів даних для чужих моделей,
// які не приводять людей. Пошуковики, AI-асистенти, прев'ю месенджерів і наш
// моніторинг (uptime.yml ходить через curl) пропускаємо завжди.
//
// Безвіконний Chrome свідомо НЕ блокуємо: ним записуються демо-відео з живого
// сайту й робляться знімки для перевірок. Від скрапера на ньому захищає
// обмеження частоти у Vercel Firewall, а не рядок User-Agent.

// Спершу — хто завжди проходить. Збіг тут сильніший за будь-яке блокування.
const ALLOW = /googlebot|google-inspectiontool|googleother|adsbot-google|mediapartners-google|bingbot|bingpreview|duckduckbot|applebot|yandex|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-user|claude-searchbot|perplexitybot|perplexity-user|ccbot|telegrambot|facebookexternalhit|meta-externalagent|whatsapp|viber|twitterbot|linkedinbot|slackbot|discordbot|skypeuripreview|chrome-lighthouse|vercel/i;

// Інструменти масового копіювання й збирачі, що забирають дані, не
// приводячи людей. Кожен рядок — бібліотека, а не браузер: живий відвідувач
// так себе не називає.
const BLOCK = /python-requests|python-urllib|python-httpx|\bhttpx\/|aiohttp|scrapy|go-http-client|^java\/|okhttp|apache-httpclient|libwww-perl|\bwget\/|node-fetch|\baxios\/|\bundici\b|bytespider|imagesiftbot|petalbot/i;

/**
 * Чи відмовити цьому запиту. ua — заголовок User-Agent.
 * Порожній User-Agent теж відсікаємо: браузер його надсилає завжди, а
 * монітори й прев'ю-боти підписуються.
 */
export function shouldBlock(ua) {
  const s = String(ua || '').trim();
  if (!s) return true;
  if (ALLOW.test(s)) return false;
  return BLOCK.test(s);
}
