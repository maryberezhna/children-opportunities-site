import test from 'node:test';
import assert from 'node:assert/strict';
import { themesOf, normalizeCategory } from '../lib/themes.js';

/**
 * Теми можливості збираються з назви, опису Й категорій джерела.
 *
 * Навіщо. Вподобання дитини в Dityam+ звіряються саме з темами, тож запис без
 * жодної теми не дійде до родини, яка обрала хоч один інтерес. Назва часто не
 * каже нічого («Зразковий колектив „Дивосвіт“»), а categories з екстракції
 * описують запис — але словника там немає: ~500 різних значень трьома мовами.
 *
 * Дзеркало: scraper/tests/test_themes_categories.py — ті самі випадки.
 */

test('категорія дає тему там, де назва мовчить', () => {
  const o = { title: 'Зразковий колектив «Дивосвіт»', summary: '', categories: ['dance', 'музика'] };
  assert.deepEqual([...themesOf(o)], ['arts']);
});

test('англомовні категорії зводяться до наших тем', () => {
  assert.ok(themesOf({ title: 'Програма', categories: ['eu', 'international'] }).has('international'));
  assert.ok(themesOf({ title: 'Клуб', categories: ['leadership'] }).has('soft_skills'));
  assert.ok(themesOf({ title: 'Проєкт', categories: ['digital', 'education'] }).has('stem'));
});

test('українські категорії теж', () => {
  assert.ok(themesOf({ title: 'Заняття', categories: ['спорт'] }).has('sport'));
  assert.ok(themesOf({ title: 'Заняття', categories: ['медіаграмотність'] }).has('soft_skills'));
});

test('регістр, підкреслення й дефіси значення не мають', () => {
  assert.equal(normalizeCategory(' Mental_Health '), 'mental health');
  assert.ok(themesOf({ title: 'x', categories: ['Mental_Health'] }).has('health'));
  assert.ok(themesOf({ title: 'x', categories: ['MARTIAL-ARTS'] }).has('sport'));
});

test('ключові слова по назві працюють як раніше', () => {
  assert.ok(themesOf({ title: 'Школа програмування для дітей', categories: [] }).has('stem'));
  assert.ok(themesOf({ title: 'Олімпіада з математики', summary: '' }).has('contests'));
});

test('нічого не вигадуємо: немає сигналу — немає теми', () => {
  assert.deepEqual([...themesOf({ title: 'Оголошення', summary: '', categories: [] })], []);
  assert.deepEqual([...themesOf({})], []);
});
