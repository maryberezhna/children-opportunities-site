import { RU_SEARCH_AGENTS } from '@/lib/ru-search';

// Політика для краулерів — свідома, а не wildcard-дефолт.
//
// AI-краулери дозволені явно: AI-асистенти вже помітний канал трафіку, а
// відкритість каталогу — принципова позиція проєкту (продаємо сервіс, не
// доступ). Явний запис у robots.txt — це сигнал «нас можна читати й цитувати»,
// на відміну від мовчазного wildcard.
//
// /admin і /api закриті для всіх: службові сторінки не мають з'являтись ні
// у видачі, ні у відповідях асистентів.

const DISALLOW = ['/admin', '/api/'];

// Пошук рф і білорусі — повна заборона (Марія, 02.10.2026). Саме цей запис
// змушує Яндекс ПРИБРАТИ сторінки з індексу: заборона в robots.txt — їхній
// документований спосіб деіндексації. Перелік — у lib/ru-search.js, звідти ж
// його читає middleware, щоб правило не існувало у двох списках.

// Answer-краулери (шукають відповідь на запит користувача — з них приходять
// люди) та training-краулери (навчання моделей — з них приходить цитованість
// у майбутніх моделях). Дозволяємо обидві групи.
const AI_CRAWLERS = [
  'GPTBot',            // OpenAI, навчання
  'OAI-SearchBot',     // OpenAI, пошук у ChatGPT
  'ChatGPT-User',      // OpenAI, запити користувачів
  'ClaudeBot',         // Anthropic, навчання
  'Claude-User',       // Anthropic, запити користувачів
  'Claude-SearchBot',  // Anthropic, пошук
  'PerplexityBot',     // Perplexity, індекс
  'Perplexity-User',   // Perplexity, запити користувачів
  'Google-Extended',   // Google, Gemini/навчання
  'Applebot-Extended', // Apple Intelligence
  'meta-externalagent',// Meta AI
  'Amazonbot',         // Alexa/Rufus
  'CCBot',             // Common Crawl (датасети для більшості моделей)
];

export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      ...RU_SEARCH_AGENTS.map((userAgent) => ({ userAgent, disallow: '/' })),
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: DISALLOW,
      })),
    ],
    sitemap: 'https://dityam.com.ua/sitemap.xml',
    host: 'https://dityam.com.ua',
  };
}
