import test from 'node:test';
import assert from 'node:assert/strict';
import { flattenReport } from '../lib/ga4.js';
import {
  audienceTotals, ukraineShare, classifyPath, pathBreakdown, eventCounts, ageBandShares,
} from '../lib/mediakit.js';

// Реальні числа GA4 за 28 днів до 03.10.2026 (перевірено через конектор).
// Звіт без вимірів — унікальні люди; розбивка — лише для повернень.
const totals = [
  { dateRange: 'date_range_0', activeUsers: 2275, sessions: 2992, screenPageViews: 9589, userEngagementDuration: 219918 },
  { dateRange: 'date_range_1', activeUsers: 3543, sessions: 4809, screenPageViews: 13977, userEngagementDuration: 302998 },
];
const byReturning = [
  { dateRange: 'date_range_0', newVsReturning: 'new', activeUsers: 2234 },
  { dateRange: 'date_range_0', newVsReturning: 'returning', activeUsers: 350 },
  { dateRange: 'date_range_0', newVsReturning: '(not set)', activeUsers: 0 },
  { dateRange: 'date_range_1', newVsReturning: 'new', activeUsers: 3532 },
  { dateRange: 'date_range_1', newVsReturning: 'returning', activeUsers: 485 },
];

test('відвідувачі — унікальні, а не нові + ті, що повернулись', () => {
  const t = audienceTotals(totals, byReturning, 'date_range_0');
  // Не 2 234 + 350 = 2 584: одна людина буває в обох рядках розбивки.
  assert.equal(t.users, 2275);
  assert.equal(t.sessions, 2992);
  assert.equal(t.views, 9589);
  assert.equal(t.returningShare, 15);
  assert.equal(t.pagesPerSession, 3.2);
  // Час взаємодії / сеанси: 219 918 / 2 992 ≈ 74 с (1:14), як у GA4.
  assert.equal(t.avgSessionSec, 74);
  assert.equal(audienceTotals(totals, byReturning, 'date_range_1').users, 3543);
});

test('частка України', () => {
  const rows = [
    { dateRange: 'date_range_0', country: 'Ukraine', activeUsers: 1655 },
    { dateRange: 'date_range_0', country: '(not set)', activeUsers: 75 },
    { dateRange: 'date_range_0', country: 'Poland', activeUsers: 51 },
    { dateRange: 'date_range_1', country: 'Ukraine', activeUsers: 10 },
  ];
  assert.equal(ukraineShare(rows, 'date_range_0'), 97);
  assert.equal(ukraineShare(rows, 'date_range_1'), 100);
});

test('шляхи: можливість, головна, підбірка', () => {
  assert.equal(classifyPath('/o/konkurs-im-petra-iatsyka-bfe6b4').kind, 'opportunity');
  assert.equal(classifyPath('/en/o/x?utm=1').kind, 'opportunity');
  assert.equal(classifyPath('/').kind, 'home');
  assert.equal(classifyPath('/en').kind, 'home');
  assert.deepEqual(classifyPath('/konkursy'), { kind: 'topic', slug: 'konkursy', label: 'Конкурси' });
  assert.equal(classifyPath('/en/contests').slug, 'konkursy');
  assert.equal(classifyPath('/plus').kind, 'other');
});

test('перегляди сторінок можливостей і топ підбірок', () => {
  const rows = [
    { dateRange: 'date_range_0', pagePath: '/', screenPageViews: 400 },
    { dateRange: 'date_range_0', pagePath: '/o/a', screenPageViews: 300 },
    { dateRange: 'date_range_0', pagePath: '/o/b', screenPageViews: 200 },
    { dateRange: 'date_range_0', pagePath: '/konkursy', screenPageViews: 60 },
    { dateRange: 'date_range_0', pagePath: '/en/contests', screenPageViews: 10 },
    { dateRange: 'date_range_0', pagePath: '/bezkoshtovni-tabory', screenPageViews: 30 },
  ];
  const b = pathBreakdown(rows, 'date_range_0');
  assert.equal(b.total, 1000);
  assert.equal(b.opportunity, 500);
  assert.equal(b.opportunityShare, 50);
  assert.equal(b.home, 400);
  assert.deepEqual(b.topTopics.map((t) => t.label), ['Конкурси', 'Табори']);
  assert.equal(b.topTopics[0].views, 70);
});

test('події й вік дітей із профілів', () => {
  const ev = eventCounts([
    { dateRange: 'date_range_0', eventName: 'opportunity_click', eventCount: 1646 },
    { dateRange: 'date_range_0', eventName: 'apply_click', eventCount: 12 },
  ], 'date_range_0');
  assert.equal(ev.opportunity_click + ev.apply_click, 1658);
  const a = ageBandShares([{ age_bands: ['7-10'] }, { age_bands: ['7-10', '11-14'] }, { age_bands: [] }]);
  assert.equal(a.children, 2);
  assert.deepEqual(a.bands[0], { band: '7-10', count: 2, share: 100 });
});

test('відповідь Data API → плоскі рядки', () => {
  const rows = flattenReport({
    dimensionHeaders: [{ name: 'dateRange' }, { name: 'country' }],
    metricHeaders: [{ name: 'activeUsers' }],
    rows: [{ dimensionValues: [{ value: 'date_range_0' }, { value: 'Ukraine' }], metricValues: [{ value: '1655' }] }],
  });
  assert.deepEqual(rows, [{ dateRange: 'date_range_0', country: 'Ukraine', activeUsers: 1655 }]);
});
