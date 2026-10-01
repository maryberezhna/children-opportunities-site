import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTION_HOST, isProductionHost, isInternalPath, isAutomationUa } from '../lib/analytics-scope.js';

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

test('автоматика за User-Agent не рахується', () => {
  assert.equal(isAutomationUa('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0 Safari/537.36'), true);
  assert.equal(isAutomationUa('Mozilla/5.0 (Linux; Android 11; moto g power) Chrome/140 Mobile Safari/537.36 Chrome-Lighthouse'), true);
  assert.equal(isAutomationUa('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'), false);
  assert.equal(isAutomationUa(''), false);
});
