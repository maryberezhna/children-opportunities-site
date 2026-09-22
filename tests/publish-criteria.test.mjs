// Python і JS читають lib/publish-criteria.json; ці приклади спільні з
// scraper/tests/test_publish_criteria.py. Розійшлись — упаде хтось один.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CRITERIA, missingRequired, missingRequiredKeys } from '../lib/required.js';

const cases = JSON.parse(readFileSync(new URL('./fixtures/publish-criteria-cases.json', import.meta.url), 'utf8'));

test('спільні приклади дають той самий результат у JS', () => {
  for (const c of cases) {
    assert.deepEqual(missingRequiredKeys(c.row), c.missing, c.name);
    assert.deepEqual(missingRequired(c.row), c.missing.map((k) => CRITERIA.required[k].label), c.name);
  }
});

test('визначення цілісне: порядок покриває всі критерії, підписи унікальні', () => {
  const keys = Object.keys(CRITERIA.required).sort();
  assert.deepEqual([...CRITERIA.order].sort(), keys);
  const labels = CRITERIA.order.map((k) => CRITERIA.required[k].label);
  assert.equal(new Set(labels).size, labels.length);
  for (const k of CRITERIA.order) {
    const c = CRITERIA.required[k];
    assert.ok(['all', 'any', 'in'].includes(c.rule), `${k}: правило`);
    assert.ok(c.fields.length > 0, `${k}: поля`);
    if (c.rule === 'in') assert.ok(c.allowed.length > 0, `${k}: словник`);
  }
  // Виняток для виплат посилається лише на типи зі словника.
  for (const t of CRITERIA.required.date.except_types) {
    assert.ok(CRITERIA.required.type.allowed.includes(t), `except_types: ${t}`);
  }
  // Публікабельна вартість — підмножина того, що приймає база.
  for (const t of CRITERIA.required.cost.allowed) {
    assert.ok(CRITERIA.cost_types_db.includes(t), `cost: ${t}`);
  }
});
