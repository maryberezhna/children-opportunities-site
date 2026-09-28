// Відбір олімпіад МОН для путівника /olimpiady.
//
// Регресія, проти якої стоїть файл: умова була написана як
// /^Всеукраїнська олімпіада\b/i, і \b у JavaScript визначена лише для
// латиниці — після кириличного «олімпіада» межі слова не існує. Умова не
// збігалася жодного разу, і сторінка стояла з порожнім списком, хоча в базі
// було 26 придатних записів. Помилка мовчазна: порожній список виглядає як
// «поки нічого немає».
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { isMonOlympiad, SUBJECTS, STAGES } = await import('../lib/olympiads.js');

const olympiad = (title) => ({ opportunity_type: 'olympiad', title });

test('предметні олімпіади МОН впізнаються', () => {
  for (const s of SUBJECTS) {
    const title = `Всеукраїнська олімпіада з предмета «${s.name}»`;
    assert.ok(isMonOlympiad(olympiad(title)), title);
  }
  // Справжні назви з бази — саме такі.
  for (const title of [
    'Всеукраїнська олімпіада з математики',
    'Всеукраїнська олімпіада з інформаційних технологій',
    'Всеукраїнська олімпіада зі штучного інтелекту (UOAI 2026)',
  ]) {
    assert.ok(isMonOlympiad(olympiad(title)), title);
  }
});

test('чуже не потрапляє', () => {
  // Тип olympiad носять і міжнародні, і олімпіада МАН — сторінка про
  // шкільний цикл МОН, тож вони тут зайві.
  assert.ok(!isMonOlympiad(olympiad('Міжнародна олімпіада з астрономії «IOAA»')));
  assert.ok(!isMonOlympiad(olympiad('Конкурс Малої академії наук України')));
  // Не той тип.
  assert.ok(!isMonOlympiad({ opportunity_type: 'competition', title: 'Всеукраїнська олімпіада з хімії' }));
  // Порожнє не валить.
  assert.ok(!isMonOlympiad(null));
  assert.ok(!isMonOlympiad({}));
});

test('перелік предметів і етапів не поламано', () => {
  assert.equal(SUBJECTS.length, 24, 'наказ МОН №1476: 24 предмети на І–ІІ етапах');
  assert.equal(SUBJECTS.filter((s) => s.third).length, 18, 'на ІІІ етапі — 18');
  assert.equal(STAGES.length, 3);
  for (const st of STAGES) {
    assert.match(st.startDate, /^\d{4}-\d{2}-\d{2}$/, st.n);
    assert.match(st.endDate, /^\d{4}-\d{2}-\d{2}$/, st.n);
    assert.ok(st.startDate < st.endDate, `${st.n}: початок має бути раніше за кінець`);
  }
});

test('вік порахований із класів правилом клас+5..клас+6', () => {
  for (const s of SUBJECTS) {
    const [lo, hi] = s.grades.split('–').map(Number);
    assert.equal(s.from, lo + 5, s.name);
    assert.equal(s.to, Math.min(18, hi + 6), s.name);
  }
});
