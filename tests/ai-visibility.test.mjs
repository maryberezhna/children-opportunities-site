// Видимість у ШІ-асистентах (22.10.2026): розпізнаємо переходи з асистентів і
// ботів, які читають сторінку під час відповіді людині.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { aiSourceFrom, aiFetcherFrom, aiLabel, parseAiLabel, summarizeAi } = await import('../lib/ai-visibility.js');
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('перехід з асистента: utm_source і реферер', () => {
  assert.equal(aiSourceFrom({ search: '?utm_source=chatgpt.com' }), 'chatgpt');
  assert.equal(aiSourceFrom({ referrer: 'https://chatgpt.com/' }), 'chatgpt');
  assert.equal(aiSourceFrom({ referrer: 'https://www.perplexity.ai/search/x' }), 'perplexity');
  assert.equal(aiSourceFrom({ referrer: 'https://gemini.google.com/app' }), 'gemini');
  assert.equal(aiSourceFrom({ referrer: 'https://copilot.microsoft.com/' }), 'copilot');
  assert.equal(aiSourceFrom({ referrer: 'https://claude.ai/chat/1' }), 'claude');
  assert.equal(aiSourceFrom({ referrer: 'https://www.google.com/' }), null);
  assert.equal(aiSourceFrom({ search: '?utm_source=telegram' }), null);
  assert.equal(aiSourceFrom({}), null);
});

test('бот відповіді: лише ті, кого асистент шле під час питання людини', () => {
  assert.equal(aiFetcherFrom('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'), 'chatgpt');
  assert.equal(aiFetcherFrom('Mozilla/5.0 (compatible; Perplexity-User/1.0)'), 'perplexity');
  assert.equal(aiFetcherFrom('Mozilla/5.0 (compatible; Claude-User/1.0)'), 'claude');
  // Роботи для індексу — ні: їх тисячі, і про відповіді вони нічого не кажуть.
  assert.equal(aiFetcherFrom('Mozilla/5.0 (compatible; GPTBot/1.1)'), null);
  assert.equal(aiFetcherFrom('Mozilla/5.0 (compatible; ClaudeBot/1.0)'), null);
  assert.equal(aiFetcherFrom('Mozilla/5.0 (compatible; PerplexityBot/1.0)'), null);
  assert.equal(aiFetcherFrom(''), null);
});

test('мітка «асистент:сторінка» й зведення для адмінки', () => {
  assert.equal(aiLabel('chatgpt', '/blog/x'), 'chatgpt:/blog/x');
  assert.ok(aiLabel('chatgpt', '/' + 'a'.repeat(200)).length <= 100);
  assert.deepEqual(parseAiLabel('perplexity:/o/abc'), { name: 'perplexity', path: '/o/abc' });
  const s = summarizeAi([
    { name: 'ai_fetch', source: 'chatgpt:/blog/x' },
    { name: 'ai_fetch', source: 'chatgpt:/blog/x' },
    { name: 'ai_visit', source: 'chatgpt:/blog/x' },
    { name: 'ai_visit', source: 'gemini:/' },
  ]);
  assert.deepEqual(s.fetches, { chatgpt: 2 });
  assert.deepEqual(s.visits, { chatgpt: 1, gemini: 1 });
  assert.deepEqual(s.topPages[0], { path: '/blog/x', visits: 1, fetches: 2 });
});

test('підключено: браузер шле ai_visit, middleware пише ai_fetch, адмінка показує', () => {
  assert.match(read('lib/site-events.js'), /AI_VISIT: 'ai_visit'/);
  assert.doesNotMatch(read('lib/site-events.js'), /ai_fetch'/);
  assert.match(read('app/Analytics.js'), /markAiVisit\(pathname\)/);
  const mw = read('middleware.js');
  assert.match(mw, /aiFetcherFrom\(/);
  assert.match(mw, /event\.waitUntil\(logAiFetch/);
  assert.match(mw, /name: 'ai_fetch'/);
  assert.match(read('app/admin/metrics/page.js'), /ШІ-асистенти, 28 днів/);
});
