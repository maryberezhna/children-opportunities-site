// «Чим закінчилось» у @DityamPlusBot (23.09.2026).
//
// Марія: «відмічають цікаво — коли можливість пройшла, то зʼявляється
// питання: ви скористалися цією можливістю? Так чи ні. Якщо так — то
// розкажіть, як вам. Якщо ні — то чому, і дропдаун з опціями».
//
// Тести тримають те, що легко тихо зламати: ліміт Telegram на callback_data,
// однозначність розбору (щоб pout: не переплутався з flow:/pfb:/papp:),
// дослівне формулювання Марії і стан для вільного тексту — він НЕ у flow_step,
// тож анкета лишається цілою.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
  parseOutcome, OUTCOME_REASONS, reasonLabel, askKeyboard, whyKeyboard, skipKeyboard,
  pendingNote, NOTE_WINDOW_MIN, ASK_STORY, ASK_WHY,
} = await import('../lib/plusOutcomes.js');

const ID = '11111111-2222-3333-4444-555555555555';
const ID2 = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

test('розбір кнопок «чим закінчилось»', () => {
  assert.deepEqual(parseOutcome(`pout:yes:${ID}`), { action: 'yes', id: ID, reason: null });
  assert.deepEqual(parseOutcome(`pout:no:${ID}`), { action: 'no', id: ID, reason: null });
  assert.deepEqual(parseOutcome(`pout:skip:${ID}`), { action: 'skip', id: ID, reason: null });
  assert.deepEqual(parseOutcome(`pout:why:price:${ID}`), { action: 'why', id: ID, reason: 'price' });
});

test('чужі кнопки не наші', () => {
  // Розбір має лишатись однозначним: анкета, 👍/👎 і «Подаємося» живуть поруч.
  for (const data of [`flow:age:7-10`, `pfb:yes:${ID}`, `papp:${ID}`, 'menu:latest',
    'promo:ask', 'pout:yes:не-uuid', `pout:why:вигадана:${ID}`, `pout:maybe:${ID}`,
    'pout:yes', '', null, undefined]) {
    assert.equal(parseOutcome(data), null, String(data));
  }
});

test('callback_data влізає в ліміт Telegram 64 байти', () => {
  const rows = [
    ...askKeyboard(ID).inline_keyboard,
    ...whyKeyboard(ID).inline_keyboard,
    ...skipKeyboard(ID).inline_keyboard,
  ];
  for (const row of rows) {
    for (const button of row) {
      assert.ok(Buffer.byteLength(button.callback_data) <= 64,
        `${button.callback_data} — ${Buffer.byteLength(button.callback_data)} байтів`);
    }
  }
});

test('кожна кнопка причини розбирається назад у свій код', () => {
  for (const [code] of OUTCOME_REASONS) {
    const button = whyKeyboard(ID).inline_keyboard.flat()
      .find((b) => b.callback_data.endsWith(`:${code}:${ID}`));
    assert.ok(button, code);
    assert.deepEqual(parseOutcome(button.callback_data), { action: 'why', id: ID, reason: code });
    assert.equal(button.text, reasonLabel(code));
  }
});

test('дропдаун причин — слова Марії, «Інша причина» остання', () => {
  assert.deepEqual(OUTCOME_REASONS.map(([, label]) => label), [
    'Не встигли, забули',
    'Передумали — не підійшло',
    'Дитина не зацікавилась',
    'Забагато документів',
    'Не підійшли умови (вік, місто, вартість)',
    'Дорого',
    'Інша причина',
  ]);
});

test('питання після «Так» — дослівно', () => {
  assert.equal(ASK_STORY, 'Розкажіть двома словами, як вам?');
  assert.equal(ASK_WHY, 'Чому?');
  // Проміжний крок «Тримаємо кулаки 🤞 Уже є відповідь?» Марія відхилила.
  assert.ok(!ASK_STORY.includes('кулаки'));
});

const minutesAgo = (n) => new Date(Date.now() - n * 60 * 1000).toISOString();

test('на вільний текст чекаємо після «Так» і після «Інша причина»', () => {
  const used = { opportunity_id: ID, stage: 'used', answered_at: minutesAgo(1), note: null };
  assert.equal(pendingNote([used]).opportunity_id, ID);

  const other = { opportunity_id: ID, stage: 'not_used', reason: 'other', answered_at: minutesAgo(1), note: null };
  assert.equal(pendingNote([other]).opportunity_id, ID);
});

test('на вільний текст не чекаємо, коли його не просили', () => {
  const cases = [
    // Причина зі списку — пояснювати нічого.
    { opportunity_id: ID, stage: 'not_used', reason: 'price', answered_at: minutesAgo(1), note: '' },
    // «Пропустити»: порожній рядок, а не null.
    { opportunity_id: ID, stage: 'used', answered_at: minutesAgo(1), note: '' },
    // Уже розповіли.
    { opportunity_id: ID, stage: 'used', answered_at: minutesAgo(1), note: 'було чудово' },
    // Спитали, але людина ще не відповіла.
    { opportunity_id: ID, stage: 'asked', asked_at: minutesAgo(1), answered_at: null, note: null },
    // «Подаємося» без жодного питання.
    { opportunity_id: ID, stage: 'applying' },
  ];
  for (const row of cases) assert.equal(pendingNote([row]), null, JSON.stringify(row));
  assert.equal(pendingNote([]), null);
});

test('через три години текст читається як питання в підтримку, а не як відгук', () => {
  const stale = { opportunity_id: ID, stage: 'used', answered_at: minutesAgo(NOTE_WINDOW_MIN + 1), note: null };
  assert.equal(pendingNote([stale]), null);
  const fresh = { opportunity_id: ID, stage: 'used', answered_at: minutesAgo(NOTE_WINDOW_MIN - 1), note: null };
  assert.equal(pendingNote([fresh]).opportunity_id, ID);
});

test('якщо чекають двоє — беремо ту відповідь, що свіжіша', () => {
  const older = { opportunity_id: ID, stage: 'used', answered_at: minutesAgo(30), note: null };
  const newer = { opportunity_id: ID2, stage: 'used', answered_at: minutesAgo(2), note: null };
  assert.equal(pendingNote([older, newer]).opportunity_id, ID2);
  assert.equal(pendingNote([newer, older]).opportunity_id, ID2);
});
