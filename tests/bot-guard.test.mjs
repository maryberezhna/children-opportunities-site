// Захист від масового копіювання (Марія, 27.09.2026): відсікаємо бібліотеки,
// пропускаємо людей, пошуковики, AI-асистентів, прев'ю й наш моніторинг.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { shouldBlock } = await import('../lib/bot-guard.js');

test('люди й браузери проходять', () => {
  for (const ua of [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    // Безвіконний Chrome — наші демо-відео й знімки; не блокуємо свідомо.
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0 Safari/537.36',
  ]) assert.equal(shouldBlock(ua), false, ua);
});

test('пошуковики, AI-асистенти, прев\'ю месенджерів і наш моніторинг проходять', () => {
  for (const ua of [
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)',
    'TelegramBot (like TwitterBot)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'WhatsApp/2.23.20.0',
    'curl/8.4.0',
    'Mozilla/5.0 (compatible; DityamLinkCheck/1.0; +https://dityam.com.ua)',
  ]) assert.equal(shouldBlock(ua), false, ua);
});

test('бібліотеки масового копіювання й порожній User-Agent — відмова', () => {
  for (const ua of [
    'python-requests/2.32.3',
    'Python-urllib/3.12',
    'python-httpx/0.27.0',
    'Scrapy/2.11.2 (+https://scrapy.org)',
    'Go-http-client/2.0',
    'Java/17.0.2',
    'okhttp/4.12.0',
    'Wget/1.21.4',
    'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
    'axios/1.7.2',
    'Mozilla/5.0 (compatible; Bytespider; spider-feedback@bytedance.com)',
    '',
    '   ',
    undefined,
  ]) assert.equal(shouldBlock(ua), true, String(ua));
});
