// Кожен варіант у питанні «Який тип можливостей підходить?» має щось
// знаходити (27.09.2026).
//
// Регресія, проти якої стоїть файл: 19.09.2026 до анкети додали три варіанти
// — «Психолог, реабілітація, здоровʼя», «Виплати й допомога родині»,
// «Волонтерство й стажування», — а списки типів під ними лишили порожніми.
// formatsOf перевіряє рівно FORMAT_TYPES і FORMAT_THEMES, тож ці три не
// поверталися НІКОЛИ: людина обирала їх і не отримувала нічого. 78 активних
// записів були недосяжні через це питання.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { FORMAT_OPTIONS, FORMAT_TYPES, formatsOf } = await import('../lib/plusProfile.js');

test('жоден варіант анкети не лишається без типів', () => {
  for (const [key, label] of FORMAT_OPTIONS) {
    assert.ok((FORMAT_TYPES[key] || []).length > 0,
      `«${label}» (${key}) не зіставлений із жодним типом — людина обере його й не отримає нічого`);
  }
});

test('кожен варіант справді знаходить свій запис', () => {
  for (const [key, label] of FORMAT_OPTIONS) {
    const probe = { opportunity_type: FORMAT_TYPES[key][0] };
    assert.ok(formatsOf(probe, new Set()).has(key), `${label} (${key})`);
  }
});

test('типи не діляться між варіантами', () => {
  // Один тип у двох групах означав би, що запис приходить двічі й людина
  // бачить його в добірці як дві різні знахідки.
  const seen = new Map();
  for (const [key, types] of Object.entries(FORMAT_TYPES)) {
    for (const t of types) {
      assert.ok(!seen.has(t), `тип «${t}» одночасно в «${seen.get(t)}» і «${key}»`);
      seen.set(t, key);
    }
  }
});

test('типи, які реально є в базі, покриті всі', () => {
  // Перелік знятий запитом до продакшн-бази 27.09.2026 (status='active').
  // Якщо конвеєр заведе новий тип, тест упаде — і це правильно: новий тип
  // має потрапити в якусь групу, інакше він мовчки випаде з добірок.
  const inBase = [
    'club', 'course', 'competition', 'olympiad', 'camp', 'volunteer', 'exchange',
    'workshop', 'allowance', 'scholarship', 'grant', 'humanitarian', 'festival',
    'psychology', 'medical_aid', 'conference', 'support_payment', 'study_program',
    'rehabilitation', 'sport_tournament', 'internship', 'educational_material',
    'summer_school', 'hackathon', 'mentorship', 'residency', 'shelter', 'excursion',
  ];
  const covered = new Set(Object.values(FORMAT_TYPES).flat());
  const missing = inBase.filter((t) => !covered.has(t));
  assert.deepEqual(missing, [], `типи без групи: ${missing.join(', ')}`);
});
