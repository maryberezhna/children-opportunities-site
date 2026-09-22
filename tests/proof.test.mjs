// Світлофор, крок 1 (22.09.2026): адмінка показує, на які поля немає цитати.
// Ті самі правила, що в scraper/proof.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import { missingProof, missingProofKeys, AGE, DATE, COST, TYPE, PLACE } from '../lib/required.js';

const ev = { age: '7–12 років', date: 'до 15 червня', cost: 'безкоштовно', type: 'табір', place: 'Славське' };
const row = (over = {}) => ({ opportunity_type: 'camp', evidence: { ...ev }, ...over });

test('усі цитати є — нічого не бракує', () => {
  assert.deepEqual(missingProofKeys(row()), []);
});

test('без evidence — усі пʼять, у сталому порядку з підписами', () => {
  assert.deepEqual(missingProofKeys(row({ evidence: undefined })), ['age', 'date', 'cost', 'type', 'place']);
  assert.deepEqual(missingProof(row({ evidence: {} })), [AGE, DATE, COST, TYPE, PLACE]);
});

test('порожній рядок і пробіли — не цитата', () => {
  assert.deepEqual(missingProofKeys(row({ evidence: { ...ev, cost: '  ' } })), ['cost']);
});

test('виплаті цитата на дату не потрібна', () => {
  const { date, ...rest } = ev;
  assert.deepEqual(missingProofKeys(row({ opportunity_type: 'allowance', evidence: rest })), []);
  assert.deepEqual(missingProofKeys(row({ opportunity_type: 'scholarship', evidence: rest })), ['date']);
});
