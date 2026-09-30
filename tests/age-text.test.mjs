import test from 'node:test';
import assert from 'node:assert/strict';
import { summaryAgeRange, ageConflict } from '../lib/age-text.js';
import { queueReason } from '../lib/queue-risk.js';

// Картка 30.09.2026: поле 8–16 з цитатою, опис із добірки — до 18.
const contest = {
  summary: 'Літературний конкурс для трьох вікових груп: 8–10, 11–13 і 14–18 років. Заявки приймають на пошту організатора.',
  age_from: 8, age_to: 16,
};

test('вік із тексту: найширший діапазон, «від … до» теж', () => {
  assert.deepEqual(summaryAgeRange(contest.summary), { from: 8, to: 18 });
  assert.deepEqual(summaryAgeRange('Участь беруть діти від 8 до 16 років.'), { from: 8, to: 16 });
  assert.deepEqual(summaryAgeRange('для дітей 6-11, підлітків 11-13 та 13-17 років'), { from: 6, to: 17 });
  assert.equal(summaryAgeRange('Гурток хору. Заняття двічі на тиждень.'), null);
});

test('тривалість — не вік', () => {
  assert.equal(summaryAgeRange('Навчальна програма розрахована на 5-7 років для дітей.'), null);
  assert.equal(summaryAgeRange('Навчання 5-7 років, живопис і графіка.'), null);
  assert.equal(summaryAgeRange('Навчання програмування тривалістю від 1 до 2 років у залежності від віку.'), null);
});

test('опис обіцяє вік поза полем — суперечність', () => {
  assert.equal(ageConflict(contest), 'в описі 8–18 років, а в полі 8–16');
  assert.equal(ageConflict({ summary: 'Нагорода для молоді 9–25 років.', age_from: 16, age_to: 18 }),
    'в описі 9–25 років, а в полі 16–18');
});

test('стеля 18 і вужчий опис — не суперечність', () => {
  // Молодь 18–30 при полі 18–18: сайт для 0–18, і це відомо.
  assert.equal(ageConflict({ summary: 'Волонтерство для молоді 18–30 років.', age_from: 18, age_to: 18 }), null);
  assert.equal(ageConflict({ summary: 'Конкурс для 13–24 років.', age_from: 13, age_to: 18 }), null);
  // Опис називає одну з груп — поле ширше, і це нормально.
  assert.equal(ageConflict({ summary: 'Курс зі ШІ для підлітків 12–17 років та інженерія для 7–11.', age_from: 7, age_to: 18 }), null);
  assert.equal(ageConflict({ summary: 'Вік 8–16 років.', age_from: null, age_to: null }), null);
});

test('у черзі така картка йде людині як суперечність', () => {
  const risk = queueReason({ ...contest, opportunity_type: 'competition', title: 'Конкурс' });
  assert.equal(risk.key, 'conflict');
  assert.match(risk.label, /в описі 8–18 років, а в полі 8–16/);
});
