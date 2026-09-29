import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWeeklyTop, day } from '../lib/weekly-top.js';

const today = day('2026-10-01');
const iso = (d) => new Date((day('2026-10-01') + d) * 86400000).toISOString().slice(0, 10);
const free = (id, type, days) => ({
  id, opportunity_type: type, cost_type: 'free', deadline: iso(days),
  title: `Безкоштовна ${id}`, summary: 'x'.repeat(130), cities: ['Київ'],
  age_from: 6, age_to: 18, details: 'опис',
});

test('правило бере три різні типи з вікна дедлайнів', () => {
  const picked = selectWeeklyTop({
    free: [free(1, 'camp', 10), free(2, 'camp', 12), free(3, 'contest', 8), free(4, 'olympiad', 9)],
    pinned: [], today,
  });
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map((o) => o.opportunity_type)).size, 3);
});

test('дедлайн поза вікном 3–30 днів не береться', () => {
  const picked = selectWeeklyTop({ free: [free(1, 'camp', 1), free(2, 'camp', 60)], pinned: [], today });
  assert.equal(picked.length, 0);
});

// Головне, заради чого правило винесене в окремий файл. Платне просування
// організаторам (500 грн за тиждень у «Топ тижня», з 21.09.2026) виконується
// саме позначкою featured_week. Доти скрипт тягнув із бази лише
// cost_type='free', тож платний запис не потрапляв ні у вибір, ні в список
// «лишити» — і крок «зняти позначку з чужих» стирав його мовчки. Партнер
// платив за тиждень і зникав із блока в день перезапуску воркфлоу.
test('платний запис, відмічений вручну, лишається в трійці', () => {
  const partner = { id: 99, opportunity_type: 'competition', cost_type: 'paid_affordable',
                    deadline: iso(20), title: 'Конкурс партнера', summary: 'y'.repeat(130),
                    cities: ['Львів'], age_from: 7, age_to: 17, featured_week: '2026-W40' };
  const picked = selectWeeklyTop({ free: [free(1, 'camp', 10), free(2, 'olympiad', 9)], pinned: [partner], today });
  assert.ok(picked.some((o) => o.id === 99), 'платний пін зник із трійки');
  assert.equal(picked.length, 3);
});

test('три ручні позначки не лишають місця правилу', () => {
  const pin = (id) => ({ id, opportunity_type: 'camp', cost_type: 'paid_affordable', title: `П${id}` });
  const picked = selectWeeklyTop({ free: [free(1, 'olympiad', 10)], pinned: [pin(7), pin(8), pin(9)], today });
  assert.deepEqual(picked.map((o) => o.id), [7, 8, 9]);
});
