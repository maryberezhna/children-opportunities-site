/**
 * Видимість у ШІ-асистентах (22.10.2026, Марія: «план, щоб ми завжди були перші
 * у видачі з AI» + «без кількох доларів»).
 *
 * Платні API асистентів не підключаємо — міряємо те, що асистенти самі лишають
 * на сайті:
 *   1. ai_visit — людина прийшла з відповіді асистента (реферер або utm_source:
 *      ChatGPT сам дописує ?utm_source=chatgpt.com до посилань). Пише браузер,
 *      раз за сесію; source = «асистент:сторінка входу».
 *   2. ai_fetch — асистент у ту саму мить, коли людина ставить питання, читає
 *      нашу сторінку, щоб відповісти (ChatGPT-User, Perplexity-User,
 *      Claude-User). Це найближче до «нас цитують», що видно безкоштовно.
 *      Пише middleware на сервері; source = «асистент:сторінка».
 * Пошукові роботи для індексу (GPTBot, ClaudeBot, PerplexityBot) не пишемо:
 * вони ходять тисячами й нічого не кажуть про відповіді людям.
 */

/** Домени й utm_source асистентів → коротка назва. Порядок важливий. */
const AI_REFERRERS = [
  ['chatgpt', /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/i],
  ['perplexity', /(^|\.)perplexity\.ai$/i],
  ['gemini', /(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/i],
  ['copilot', /(^|\.)copilot\.microsoft\.com$/i],
  ['claude', /(^|\.)claude\.ai$/i],
];

const UTM_AI = [
  ['chatgpt', /chatgpt|openai/i],
  ['perplexity', /perplexity/i],
  ['gemini', /gemini/i],
  ['copilot', /copilot/i],
  ['claude', /claude/i],
];

/** Боти, яких асистент посилає по сторінку під час відповіді людині. */
const AI_FETCHERS = [
  ['chatgpt', /ChatGPT-User/i],
  ['perplexity', /Perplexity-User/i],
  ['claude', /Claude-User/i],
];

export const AI_NAMES = Object.freeze(['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude']);

/** З якого асистента прийшла людина: 'chatgpt' | … | null. */
export function aiSourceFrom({ search = '', referrer = '' } = {}) {
  const utm = new URLSearchParams(search).get('utm_source') || '';
  if (utm) {
    const hit = UTM_AI.find(([, re]) => re.test(utm));
    if (hit) return hit[0];
  }
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname;
    const hit = AI_REFERRERS.find(([, re]) => re.test(host));
    return hit ? hit[0] : null;
  } catch {
    return null;
  }
}

/** Який асистент читає сторінку для відповіді людині: 'chatgpt' | … | null. */
export function aiFetcherFrom(userAgent = '') {
  const hit = AI_FETCHERS.find(([, re]) => re.test(String(userAgent || '')));
  return hit ? hit[0] : null;
}

/** Мітка для site_events.source: «асистент:шлях», не довше 100 знаків. */
export const aiLabel = (name, path) => `${name}:${String(path || '/')}`.slice(0, 100);

/** Розбирає мітку назад: { name, path }. */
export function parseAiLabel(source = '') {
  const i = String(source).indexOf(':');
  if (i < 0) return { name: String(source), path: '' };
  return { name: source.slice(0, i), path: source.slice(i + 1) };
}

/**
 * Зведення для адмінки з рядків site_events (name, source): по асистентах і
 * найчастіші сторінки. Повертає { visits: {name: n}, fetches: {name: n},
 * topPages: [{ path, visits, fetches }] }.
 */
export function summarizeAi(rows = [], top = 10) {
  const visits = {};
  const fetches = {};
  const pages = new Map();
  for (const r of rows) {
    const { name, path } = parseAiLabel(r.source || '');
    if (!name) continue;
    const bucket = r.name === 'ai_fetch' ? fetches : r.name === 'ai_visit' ? visits : null;
    if (!bucket) continue;
    bucket[name] = (bucket[name] || 0) + 1;
    const p = pages.get(path) || { path, visits: 0, fetches: 0 };
    if (r.name === 'ai_fetch') p.fetches += 1; else p.visits += 1;
    pages.set(path, p);
  }
  const topPages = [...pages.values()]
    .sort((a, b) => (b.fetches + b.visits) - (a.fetches + a.visits))
    .slice(0, top);
  return { visits, fetches, topPages };
}
