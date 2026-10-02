// Кому пишемо, коли людина зависла на шляху до оплати (28.09.2026).
//
// До цього не писали нікому й ніколи. @ttanyaost стояла на кроці з телефоном
// із 24.09, @Olka666 з 26.09 — обидві заблокували бота раніше, ніж хтось
// помітив. Саме мовчання після зупинки й зробило бота джерелом роздратування.
//
// Ціна помилки тут несиметрична: не написати — втратити людину мовчки,
// написати двічі — стати тим, від чого блокують. Тому «рівно один раз»
// перевіряється окремо.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { STALL_MINUTES, stallStage, shouldNudge, nudgeText,
        NUDGE_SILENT_HOURS, provesNudgerSilent } = await import('../lib/nudge.js');
const { readFileSync } = await import('node:fs');

const NOW = new Date('2026-09-28T12:00:00Z');
const agoMin = (m) => new Date(NOW.getTime() - m * 60000).toISOString();
const sub = (over = {}) => ({
  status: 'pending', consent_at: '2026-09-28T11:00:00Z', flow_step: null,
  stuck_notice_at: null, updated_at: agoMin(10), ...over,
});

test('місце зупинки визначається по стану, а не вгадується', () => {
  assert.equal(stallStage(sub({ consent_at: null })), 'consent');
  assert.equal(stallStage(sub({ flow_step: 'age' })), 'form');
  assert.equal(stallStage(sub({ flow_step: 'phone' })), 'phone');
  // Анкета заповнена (є дитина), кроку немає — лишилась оплата.
  assert.equal(stallStage(sub(), { hasChild: true }), 'pay');
  // Кроку немає, але й дитини немає: анкету не почали.
  assert.equal(stallStage(sub(), { hasChild: false }), 'form');
});

test('активного підписника не чіпаємо ніколи', () => {
  assert.equal(stallStage(sub({ status: 'active' }), { hasChild: true }), null);
  assert.equal(shouldNudge(sub({ status: 'active' }), { hasChild: true, now: NOW }), false);
});

test(`пишемо не раніше ніж через ${STALL_MINUTES} хвилин`, () => {
  assert.equal(shouldNudge(sub({ updated_at: agoMin(1) }), { now: NOW }), false);
  assert.equal(shouldNudge(sub({ updated_at: agoMin(4) }), { now: NOW }), false);
  assert.equal(shouldNudge(sub({ updated_at: agoMin(STALL_MINUTES) }), { now: NOW }), true);
  assert.equal(shouldNudge(sub({ updated_at: agoMin(60) }), { now: NOW }), true);
});

test('рівно один раз на людину', () => {
  assert.equal(shouldNudge(sub({ stuck_notice_at: agoMin(30) }), { now: NOW }), false);
});

test('без дати останньої дії не пишемо навмання', () => {
  assert.equal(shouldNudge(sub({ updated_at: null, created_at: null }), { now: NOW }), false);
});

test('текст є на кожне місце зупинки й веде до однієї дії', () => {
  for (const stage of ['consent', 'form', 'phone', 'pay']) {
    const t = nudgeText(stage);
    assert.ok(t && t.length > 40, stage);
    // Кожен закінчується запрошенням сказати, чому передумали: відмова —
    // теж відповідь, і вона цінніша за мовчання.
    assert.match(t, /передумали/, stage);
  }
  assert.equal(nudgeText('казна-що'), null);
});

test('на кроці з телефоном кажемо, що його можна пропустити', () => {
  // Саме тут стали двоє: крок був глухим кутом, і текст має знімати причину,
  // а не просто нагадувати про існування бота.
  assert.match(nudgeText('phone'), /пропустити/);
});

// --- cron, що мовчки не ходить (02.10.2026) ---
//
// /api/cron/nudge-stuck розкладений у vercel.json на кожні пʼять хвилин, але
// тариф Hobby такої частоти не дає. Тоді вся турбота про тих, хто зупинився
// перед оплатою, не відбувається — мовчки, бо нічого не падає. Той самий спосіб
// ламатись, що й у перевірок з цитатами: правило є, ніхто його не кличе.
const LATER = new Date('2026-10-02T12:00:00Z');

test('стоїть годинами без жодного слова — нагадувач не ходить', () => {
  assert.equal(provesNudgerSilent(
    { status: 'paused', updated_at: '2026-10-02T09:00:00Z' }, LATER), true);
});

test('стоїть десять хвилин — це ще не доказ', () => {
  // Межа з запасом у десятки разів від STALL_MINUTES, щоб не кричати на збіг.
  assert.equal(provesNudgerSilent(
    { status: 'paused', updated_at: '2026-10-02T11:50:00Z' }, LATER), false);
  assert.ok(NUDGE_SILENT_HOURS * 60 > STALL_MINUTES * 10);
});

test('уже писали — тиші немає', () => {
  assert.equal(provesNudgerSilent({
    status: 'paused', updated_at: '2026-10-02T06:00:00Z',
    stuck_notice_at: '2026-10-02T06:10:00Z',
  }, LATER), false);
});

test('заплатив або відписався — тиша законна', () => {
  for (const status of ['active', 'unsubscribed']) {
    assert.equal(provesNudgerSilent(
      { status, updated_at: '2026-10-01T06:00:00Z' }, LATER), false, status);
  }
});

test('без дат не вигадуємо тишу', () => {
  assert.equal(provesNudgerSilent({ status: 'paused' }, LATER), false);
  assert.equal(provesNudgerSilent(null, LATER), false);
});

test('зведення справді дивиться на це', () => {
  // Правило без виклику — те саме, що його немає.
  const src = readFileSync(new URL('../scripts/morning-brief.mjs', import.meta.url), 'utf8');
  assert.match(src, /provesNudgerSilent\(/, 'зведення не кличе перевірку');
  assert.match(src, /stuck_notice_at/, 'зведення не читає позначку — перевірка була б сліпа');
});
