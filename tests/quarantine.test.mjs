import test from 'node:test';
import assert from 'node:assert/strict';
import { quarantineCriteria, quarantineSnippet, textDates, verdictPatch } from '../lib/quarantine.js';

// Карантин в адмінці: людина вирішує за секунду — вік, хто може подаватись, суть.

test('витяг бере вік і «хто може» з опису Eurodesk', () => {
  const s = quarantineSnippet('World Heritage Volunteers Age: 18 to 30 Who can apply: young people from all countries. Details…');
  assert.equal(s.age, '18 to 30');
  assert.match(s.who, /young people/);
});

test('вік українською теж знаходиться', () => {
  assert.equal(quarantineSnippet('Табір для дітей 7–12 років у Карпатах').age, '7–12 років');
});

test('віку немає — так і кажемо, а не вигадуємо', () => {
  assert.equal(quarantineSnippet('Greenpeace volunteer programme. Join us.').age, null);
});

test('«Завести можливість» повертає в чергу з рішенням людини', () => {
  const p = verdictPatch('accept', new Date('2026-09-21T12:00:00Z'));
  assert.equal(p.status, 'pending');
  assert.equal(p.attempts, 0);
  assert.equal(p.review_verdict, 'accept');
  assert.equal(p.reviewed_at, '2026-09-21T12:00:00.000Z');
});

test('«Відхилити» — назавжди, з вердиктом для тюнінгу порога', () => {
  const p = verdictPatch('reject');
  assert.equal(p.status, 'rejected');
  assert.equal(p.review_verdict, 'reject');
});

test('невідома дія нічого не міняє', () => {
  assert.equal(verdictPatch('delete'), null);
});

// ── За критеріями (22.09.2026) ────────────────────────────────────────────
// Фрагменти — справжні тексти з карантину того дня.

const TODAY = new Date('2026-09-22T10:00:00Z');

test('Eurodesk: дедлайн попереду — актуальна', () => {
  const c = quarantineCriteria('Volunteering Projects',
    'Volunteering Projects Дедлайн подачі: 01/10/2026 Grants for organisations to launch volunteering projects. EU 01/10/2026', TODAY);
  assert.equal(c.actual, 'yes');
  assert.deepEqual(c.future, ['01.10.2026']);
});

test('конференція 24–27 вересня 2025 — усі дати минули', () => {
  const c = quarantineCriteria('International Youth Conference',
    'Join global youth leaders in New York City from 24-27 September 2025. The call for participants is open!', TODAY);
  assert.equal(c.actual, 'no');
  assert.deepEqual(c.past, ['27.09.2025']);
});

test('ONGOING, а в тексті лише минулі дати — не ✓, а «звір»', () => {
  const c = quarantineCriteria('International Youth Conference',
    'Дедлайн подачі: ONGOING Join global youth leaders in New York City from 24-27 September 2025', TODAY);
  assert.equal(c.actual, 'unknown');
  assert.equal(c.conflict, true);
});

test('ONGOING у Eurodesk — постійний набір, теж актуальна', () => {
  const c = quarantineCriteria('Worldpackers', 'Worldpackers Дедлайн подачі: ONGOING Opportunity that connects travellers', TODAY);
  assert.equal(c.actual, 'yes');
  assert.equal(c.ongoing, true);
});

test('дата публікації поста — не дата подачі', () => {
  const c = quarantineCriteria('Почати готуватися до НМТ',
    'Дата публікації: 2026-09-17 Почати готуватися до НМТ простіше, ніж здається!', TODAY);
  assert.equal(c.actual, 'unknown');
  assert.equal(c.found.date, false);
});

test('діапазон через два місяці: рік лише в кінці — перша дата без року', () => {
  const d = textDates('Коли: 24 жовтня – 1 листопада 2026 року. Кінофестиваль «Молодість»');
  assert.deepEqual(d.dated.map((x) => x.label), ['01.11.2026']);
  assert.deepEqual(d.undated, ['24 жовтня']);
});

test('дата без року лишається без року — не вгадуємо', () => {
  const c = quarantineCriteria('Англомовна освіта за кордоном 2027',
    'Дата публікації: 2026-09-18 🗓 24 вересня о 19:00 — безкоштовний вебінар', TODAY);
  assert.equal(c.actual, 'unknown');
  assert.deepEqual(c.undated, ['24 вересня']);
  assert.equal(c.found.date, true);
});

test('повна: вік, вартість і формат знаходяться в тексті', () => {
  const c = quarantineCriteria('GoGlobal Volunteering',
    'Call for English speaking online volunteers Age: 18 to - ONGOING. Free of charge.', TODAY);
  assert.equal(c.found.age, 'від 18');
  assert.equal(c.found.cost, 'безкоштовно');
  assert.equal(c.found.place, 'онлайн');
});

test('місто з переліку — в називному відмінку', () => {
  assert.equal(quarantineCriteria('Табір', 'Табір у Києві для дітей 7–12 років', TODAY).found.place, 'Київ');
});

test('«Де:» без міста з переліку — як написано', () => {
  assert.equal(quarantineCriteria('Табір', 'Де: Буковель Коли: 1–10 липня', TODAY).found.place, 'Буковель');
});

test('чого немає в тексті — null, а не здогад', () => {
  const c = quarantineCriteria('Greenpeace volunteer programme', 'Volunteer to take action for the environment.', TODAY);
  assert.deepEqual(c.found, { age: null, date: false, cost: null, place: null });
});

test('мова: англійський текст — не українською; український — так', () => {
  assert.equal(quarantineCriteria('SUSI Scholarships', 'Higher education grants for students.', TODAY).ukrainian, false);
  assert.equal(quarantineCriteria('Волонтерство на кінофестивалі',
    'Кінофестиваль «Молодість» шукає волонтерів у команду.', TODAY).ukrainian, true);
});

test('назва-рубрика каналу — сигнал, що в пості може бути кілька можливостей', () => {
  assert.equal(quarantineCriteria('#онлайн', '#онлайн #англійська Вже розписали дитині гуртки?', TODAY).rubric, true);
  assert.equal(quarantineCriteria('Київ', '​ # Київ Волонтерство на 55-му кінофестивалі', TODAY).rubric, true);
  assert.equal(quarantineCriteria('Worldpackers', 'Worldpackers connects travellers', TODAY).rubric, false);
});

test('Eurodesk «лише для організацій» помічається', () => {
  assert.equal(quarantineCriteria('Volunteering Projects',
    'This opportunity is available for: Organisations Volunteering Projects Grants', TODAY).orgsOnly, true);
  assert.equal(quarantineCriteria('Generation Climate Europe',
    'This opportunity is available for: Young people Generation Climate Europe', TODAY).orgsOnly, false);
});
