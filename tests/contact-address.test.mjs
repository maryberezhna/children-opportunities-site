// Контакт у формі звернення — лише email або нік у Telegram (07.10.2026).
//
// Привід: звернення про «Дитячу студію Театру Франка» прийшло лише з номером
// телефону, і відповісти людині не було як. Тут перевіряємо, що телефон
// більше не проходить, а пошта й нік у звичних формах — проходять.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { parseContact, contactHref } = await import('../lib/contactAddress.js');

test('email приймається як є', () => {
  assert.deepEqual(parseContact(' natalia@gmail.com '), { kind: 'email', value: 'natalia@gmail.com' });
});

test('нік у Telegram — з @ або посиланням, завжди повертається як @nick', () => {
  for (const v of ['@natalia_k', 't.me/natalia_k', 'https://t.me/natalia_k', 'https://telegram.me/natalia_k/']) {
    assert.deepEqual(parseContact(v), { kind: 'telegram', value: '@natalia_k' }, v);
  }
});

test('телефон у будь-якому вигляді не приймається', () => {
  // Номер вигаданий навмисно: до 22.10.2026 тут стояв справжній номер людини зі
  // «Звернень», а репозиторій відкритий.
  for (const v of ['0671234567', '+380 67 123 45 67', '(067) 123-45-67', '380671234567']) {
    assert.equal(parseContact(v), null, v);
  }
});

test('голе ім\'я, кирилиця, закороткий нік чи порожнє — ні', () => {
  for (const v of ['Natalia', 'Наталія', '@наталія', '@nat', '@1natalia', '', '   ', null, undefined]) {
    assert.equal(parseContact(v), null, String(v));
  }
});

test('посилання для модератора', () => {
  assert.equal(contactHref(parseContact('@natalia_k')), 'https://t.me/natalia_k');
  assert.equal(contactHref(parseContact('natalia@gmail.com')), 'mailto:natalia@gmail.com');
  assert.equal(contactHref(null), null);
});
