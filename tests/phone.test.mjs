// Номер телефону, написаний руками (27.09.2026).
//
// Привід: дві людини з заповненою анкетою стояли на кроці «телефон для
// оплати». Бот приймав номер лише кнопкою `request_contact`, а на текст не
// відповідав нічим — гілка підтримки працювала тільки для активних
// підписників. Тут перевіряємо, що набраний руками номер читається, а слово,
// промокод чи обрізаний номер не перетворюються у «валідний».
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { parsePhone, looksLikePhoneAttempt } = await import('../lib/phone.js');

test('формати, якими люди пишуть номер, зводяться до одного', () => {
  for (const written of [
    '+380671234567', '380671234567', '0671234567', '671234567',
    '+380 67 123 45 67', '(067) 123-45-67', '067-123-45-67',
    ' 0 6 7 1 2 3 4 5 6 7 ', '+38 (067) 123 45 67', '80671234567',
  ]) {
    assert.equal(parsePhone(written), '+380671234567', written);
  }
});

test('усі українські коди операторів проходять', () => {
  // 039 Київстар/lifecell, 05x Vodafone, 06x/09x Київстар, 07x lifecell.
  for (const code of ['39', '50', '63', '66', '68', '73', '93', '95', '96', '97', '98', '99']) {
    assert.equal(parsePhone(`0${code}1234567`), `+380${code}1234567`, code);
  }
});

test('слова номером не стають', () => {
  // «first» — справжній промокод: якби він читався як номер, людина втратила б
  // знижку. Перевірка на літери стоїть до цифр саме через це.
  for (const notPhone of ['first', 'дякую', 'а скільки коштує?', '', '   ', null, undefined,
    'мій номер 0671234567', '+380671234567 це робочий']) {
    assert.equal(parsePhone(notPhone), null, String(notPhone));
  }
});

test('обрізаний чи задовгий номер відхиляється, а не доклеюється', () => {
  // До виправлення '+380671234' давало '+380380671234': дев'ять цифр
  // «380671234» брались як номер без коду країни.
  assert.equal(parsePhone('+380671234'), null);
  assert.equal(parsePhone('067123456'), null);      // 9 цифр із нулем — бракує однієї
  assert.equal(parsePhone('3806712345678'), null);  // на цифру більше
  assert.equal(parsePhone('067'), null);
});

test('числа, що не є номерами, не проходять', () => {
  assert.equal(parsePhone('2026'), null);
  assert.equal(parsePhone('119'), null);            // ціна Dityam+
  assert.equal(parsePhone('0121234567'), null);     // 01 — не код оператора
});

test('схоже на номер — привід відповісти, а не промовчати', () => {
  assert.ok(looksLikePhoneAttempt('067 123 456'));   // не дописала
  assert.ok(looksLikePhoneAttempt('+380671234'));
  assert.ok(!looksLikePhoneAttempt('first'));
  assert.ok(!looksLikePhoneAttempt('а коли прийде добірка'));
  assert.ok(!looksLikePhoneAttempt('067'));
});
