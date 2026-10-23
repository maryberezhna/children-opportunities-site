// Заплановані дописи в канал (23.10.2026): надсилаємо вчасно, у межах вікна, і
// лише те, що описано.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { dueItems, SCHEDULE, SEND_WINDOW_MS, CHANNEL } = await import('../lib/channel-schedule.js');
const { pollByKey, POLLS } = await import('../scripts/channel-polls.js');

const item = { key: 'x', kind: 'poll', poll: 'applied', at: '2026-10-26T17:00:00Z' };

test('до часу — нічого, у вікні — так, після вікна — вже ні', () => {
  assert.deepEqual(dueItems([item], new Date('2026-10-26T16:59:00Z')), []);
  assert.deepEqual(dueItems([item], new Date('2026-10-26T17:00:00Z')), [item]);
  assert.deepEqual(dueItems([item], new Date('2026-10-26T19:59:00Z')), [item]);
  assert.deepEqual(dueItems([item], new Date(Date.parse(item.at) + SEND_WINDOW_MS)), []);
});

test('опитування в понеділок 26.10 о 19:00 за Києвом — це 17:00 UTC (зимовий час з 25.10)', () => {
  const it = SCHEDULE.find((s) => s.key === 'poll-applied-2026-10');
  assert.ok(it);
  assert.equal(it.at, '2026-10-26T17:00:00Z');
  const kyiv = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', weekday: 'long', hour: '2-digit', minute: '2-digit' })
    .format(new Date(it.at));
  assert.match(kyiv, /понеділок/);
  assert.match(kyiv, /19:00/);
});

test('кожен запис розкладу — відомого виду, з унікальним key і існуючим опитуванням', () => {
  const keys = SCHEDULE.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const s of SCHEDULE) {
    assert.ok(['poll', 'preview'].includes(s.kind), s.kind);
    if (s.kind === 'poll') assert.ok(POLLS[s.poll], s.poll);
    if (s.kind === 'preview') {
      const target = SCHEDULE.find((t) => t.key === s.of);
      assert.ok(target, `превʼю ${s.key} без цілі ${s.of}`);
      // Рівно за добу до публікації — щоб встигнути виправити.
      assert.equal(Date.parse(target.at) - Date.parse(s.at), 24 * 60 * 60 * 1000);
    }
  }
  assert.equal(CHANNEL, '@dityam_com_ua');
});

test('опитування «applied»: одна відповідь, 6 варіантів, у межах лімітів Telegram, без емодзі у варіантах', () => {
  const p = pollByKey('applied');
  assert.equal(p.multiple ?? false, false);
  assert.equal(p.options.length, 6);
  assert.ok(p.question.length <= 300);
  for (const o of p.options) {
    assert.ok(o.length <= 100, o);
    assert.doesNotMatch(o, /\p{Extended_Pictographic}/u, o);
  }
  assert.match(p.question, /Dityam\.com\.ua/);
});

test('cron Vercel викликає маршрут, а маршрут закритий CRON_SECRET і тримає замок', () => {
  const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
  assert.ok(cfg.crons.some((c) => c.path === '/api/cron/channel-scheduled'));
  const route = readFileSync('app/api/cron/channel-scheduled/route.js', 'utf8');
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /channel_scheduled_sent/);
});
