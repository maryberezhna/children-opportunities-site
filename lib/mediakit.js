/**
 * Показники для рекламодавця (медіакіт) — лише в адмінці (Марія, 30.09.2026:
 * «тільки в адмінці роби»). Не 20 метрик, а ті, що відповідають на «скільки
 * людей мене побачить і наскільки це моя аудиторія»:
 *   відвідувачі · перегляди · час · сторінок за сеанс · повернення ·
 *   Україна · топ підбірок · перегляди сторінок можливостей ·
 *   переходи до організаторів · CTR карток на головній.
 *
 * Цифри — з GA4 (lib/ga4.js) за 28 і 90 днів; аудиторія Dityam+ — з бази
 * (вік дітей із профілів). Нічого не округлюємо «для краси»: медіакіт із
 * фактичних чисел складає Марія, тут — сировина.
 *
 * Чисті функції (rows → числа) окремо від fetch, щоб їх можна було тестувати
 * на фікстурах без GA4.
 */
import { ga4Configured, runReport } from './ga4.js';
import { TOPIC_LIST } from './topics.js';

export const RANGES = [
  { startDate: '28daysAgo', endDate: 'yesterday' },
  { startDate: '90daysAgo', endDate: 'yesterday' },
];
export const RANGE_KEYS = ['date_range_0', 'date_range_1'];
export const RANGE_LABELS = ['28 днів', '90 днів'];

// Переходи до організатора: з кнопки на сторінці можливості й із форми заявки.
export const OUTBOUND_EVENTS = ['opportunity_click', 'apply_click'];

const byRange = (rows, key) => rows.filter((r) => r.dateRange === key);
const sum = (rows, m) => rows.reduce((n, r) => n + (Number(r[m]) || 0), 0);
export const pct = (part, total) => (total ? Math.round((part / total) * 100) : null);

/** Відвідувачі, сеанси, перегляди, час, сторінок/сеанс, частка тих, хто повернувся. */
export function audienceTotals(rows, rangeKey) {
  const rs = byRange(rows, rangeKey).filter((r) => r.newVsReturning !== '(not set)');
  const users = sum(rs, 'activeUsers');
  const sessions = sum(rs, 'sessions');
  const views = sum(rs, 'screenPageViews');
  const returning = sum(rs.filter((r) => r.newVsReturning === 'returning'), 'activeUsers');
  // Час — «середній час взаємодії за сеанс», як у інтерфейсі GA4:
  // userEngagementDuration / sessions. НЕ averageSessionDuration: та рахує
  // від першої до останньої події сеансу, і наші telegram_popup_shown /
  // scroll її роздувають до 4:49 (Марія, 30.09.2026: «це неможливо»).
  const engaged = sum(rs, 'userEngagementDuration');
  return {
    users, sessions, views,
    returningShare: pct(returning, users),
    avgSessionSec: sessions ? Math.round(engaged / sessions) : null,
    pagesPerSession: sessions ? Math.round((views / sessions) * 10) / 10 : null,
  };
}

/** Частка України серед відвідувачів (без «(not set)»). */
export function ukraineShare(rows, rangeKey) {
  const rs = byRange(rows, rangeKey).filter((r) => r.country !== '(not set)');
  return pct(sum(rs.filter((r) => r.country === 'Ukraine'), 'activeUsers'), sum(rs, 'activeUsers'));
}

/** Куди шлях веде: сторінка можливості, підбірка (яка), головна чи інше. */
export function classifyPath(path) {
  const p = String(path || '').split('?')[0].replace(/\/$/, '') || '/';
  if (/^(\/en)?\/o\//.test(p)) return { kind: 'opportunity' };
  if (p === '/' || p === '/en') return { kind: 'home' };
  for (const t of TOPIC_LIST) {
    if (p === `/${t.slug}` || p === `/en/${t.en?.slug}`) return { kind: 'topic', slug: t.slug, label: t.nav };
  }
  return { kind: 'other' };
}

/** Перегляди сторінок можливостей, головної і топ підбірок. */
export function pathBreakdown(rows, rangeKey, top = 6) {
  const rs = byRange(rows, rangeKey);
  let opportunity = 0; let home = 0; let total = 0;
  const topics = new Map();
  for (const r of rs) {
    const v = Number(r.screenPageViews) || 0;
    total += v;
    const c = classifyPath(r.pagePath);
    if (c.kind === 'opportunity') opportunity += v;
    else if (c.kind === 'home') home += v;
    else if (c.kind === 'topic') topics.set(c.label, (topics.get(c.label) || 0) + v);
  }
  const topTopics = [...topics.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
    .map(([label, views]) => ({ label, views }));
  return { total, opportunity, opportunityShare: pct(opportunity, total), home, topTopics };
}

/** Кількість подій за назвами. */
export function eventCounts(rows, rangeKey) {
  const out = {};
  for (const r of byRange(rows, rangeKey)) out[r.eventName] = (out[r.eventName] || 0) + (Number(r.eventCount) || 0);
  return out;
}

/** Розподіл віку дітей у профілях Dityam+ (age_bands — масиви на дитину). */
export function ageBandShares(children) {
  const counts = {};
  let n = 0;
  for (const c of children || []) {
    const bands = Array.isArray(c.age_bands) ? c.age_bands : [];
    if (!bands.length) continue;
    n += 1;
    for (const b of bands) counts[b] = (counts[b] || 0) + 1;
  }
  return {
    children: n,
    bands: Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([band, k]) => ({ band, count: k, share: pct(k, n) })),
  };
}

/** Усе разом для адмінки. Без ключа GA4 — configured: false і лише база. */
export async function mediaKit({ children = [] } = {}) {
  const audience = ageBandShares(children);
  if (!ga4Configured()) return { configured: false, audience };
  const [totalsRows, countryRows, pathRows, eventRows] = await Promise.all([
    runReport({
      dateRanges: RANGES, dimensions: [{ name: 'newVsReturning' }],
      metrics: ['activeUsers', 'sessions', 'screenPageViews', 'userEngagementDuration'].map((name) => ({ name })),
    }),
    runReport({ dateRanges: RANGES, dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }], limit: 300 }),
    runReport({
      dateRanges: RANGES, dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }], limit: 5000,
    }),
    runReport({
      dateRanges: RANGES, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: [...OUTBOUND_EVENTS, 'card_click'] } } },
    }),
  ]);
  const ranges = RANGE_KEYS.map((key, i) => {
    const totals = audienceTotals(totalsRows, key);
    const paths = pathBreakdown(pathRows, key);
    const events = eventCounts(eventRows, key);
    const outbound = OUTBOUND_EVENTS.reduce((n, e) => n + (events[e] || 0), 0);
    return {
      label: RANGE_LABELS[i],
      ...totals,
      ukraineShare: ukraineShare(countryRows, key),
      opportunityViews: paths.opportunity,
      opportunityShare: paths.opportunityShare,
      topTopics: paths.topTopics,
      outbound,
      outboundPerUsers: pct(outbound, totals.users),
      homeViews: paths.home,
      cardClicks: events.card_click || 0,
      // CTR карток на головній: кліки card_click на перегляди головної. Показів
      // окремої картки GA4 не рахує — це верхня межа для «Топ тижня».
      homeCtr: paths.home ? Math.round(((events.card_click || 0) / paths.home) * 1000) / 10 : null,
    };
  });
  return { configured: true, ranges, audience };
}
