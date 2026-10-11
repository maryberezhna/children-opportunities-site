import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardTone, CARD_TONES } from '../lib/card-tone.js';
import { TYPE_LABELS } from '../lib/labels.js';

// Дві колонки на телефоні (11.10.2026): смуга кольору родини типу.
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('кожен тип має свою родину, а не випадковий відкат', () => {
  // Новий тип у labels.js без родини мовчки став би бірюзовим «навчанням».
  const fallback = Object.keys(TYPE_LABELS).filter((t) => cardTone(t) === 'learn');
  const learn = ['course', 'workshop', 'summer_school', 'study_program', 'mentorship', 'club', 'educational_material', 'study_abroad'];
  assert.deepEqual(fallback.filter((t) => !learn.includes(t)), [], 'тип без родини в lib/card-tone.js');
  assert.equal(cardTone('competition'), 'compete');
  assert.equal(cardTone('grant'), 'money');
  assert.equal(cardTone(undefined), 'learn');
});

test('у cards.css є колір на кожну родину, і він з токенів', () => {
  const css = read('app/styles/cards.css');
  for (const tone of CARD_TONES) {
    const m = new RegExp(`\\.card\\[data-tone="${tone}"\\]\\s*\\{([^}]*)\\}`).exec(css);
    assert.ok(m, `немає кольору для data-tone="${tone}"`);
    assert.ok(/--tone-bg:\s*var\(--/.test(m[1]) && /--tone-ink:\s*var\(--/.test(m[1]),
      `${tone}: колір не з токенів — нічний режим його не перефарбує`);
  }
});

test('дві колонки ввімкнені на головній, у містах і підбірках, але не в «Підліткам»', () => {
  assert.ok(read('app/OpportunityCard.js').includes('data-tone={cardTone('));
  assert.ok(/\$\{teens \? '' : ' cards-2m'\}/.test(read('app/OpportunitiesList.js')));
  assert.ok(read('app/topic/TopicCards.js').includes('tp-grid cards-2m'));
});
