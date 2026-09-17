import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_HOST, isProductionHost, isInternalPath } from '../lib/analytics-scope.js';

test('рахуємо лише бойовий домен', () => {
  assert.equal(isProductionHost('dityam.com.ua'), true);
  assert.equal(isProductionHost('www.dityam.com.ua'), true);
  // Знімки верстки й прев'ю — не аудиторія (17.09.2026: 38 переглядів із localhost).
  assert.equal(isProductionHost('localhost'), false);
  assert.equal(isProductionHost('127.0.0.1'), false);
  assert.equal(isProductionHost('children-opportunities-site.vercel.app'), false);
  // Схожі чужі домени не проходять.
  assert.equal(isProductionHost('notdityam.com.ua'), false);
  assert.equal(isProductionHost('dityam.com.ua.example.com'), false);
});

test('регулярка переживає вставку в inline-скрипт', () => {
  // Analytics.js друкує PRODUCTION_HOST у текст скрипта; розібраний назад,
  // він має поводитись так само.
  const parsed = new Function(`return ${PRODUCTION_HOST};`)();
  assert.equal(parsed.test('dityam.com.ua'), true);
  assert.equal(parsed.test('localhost'), false);
});

test('адмінка — внутрішній маршрут', () => {
  assert.equal(isInternalPath('/admin'), true);
  assert.equal(isInternalPath('/admin/plus'), true);
  assert.equal(isInternalPath('/about'), false);
  assert.equal(isInternalPath(null), false);
});
