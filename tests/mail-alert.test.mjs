// Збій пошти — в адмін-чат, а не лише в журнал (24.10.2026: після зміни пароля
// акаунта hellodityam листи педагогам два дні мовчки не йшли).
import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.WAYFORPAY_MERCHANT_ACCOUNT = 'm';
process.env.WAYFORPAY_SECRET_KEY = 's';
const { isMailAuthError, mailAlertText } = await import('../lib/olimpiada-mail.js');

test('збій входу в Gmail упізнаємо за кодом і за текстом', () => {
  assert.ok(isMailAuthError({ code: 'EAUTH' }));
  assert.ok(isMailAuthError({ responseCode: 535 }));
  assert.ok(isMailAuthError(new Error('Invalid login: 535-5.7.8 Username and Password not accepted.')));
  assert.ok(!isMailAuthError(new Error('Connection timeout')));
  assert.ok(!isMailAuthError({ code: 'ETIMEDOUT' }));
  assert.ok(!isMailAuthError(null));
});

test('сповіщення каже, що зламалось і що робити', () => {
  const auth = mailAlertText('auth');
  assert.match(auth, /Gmail не приймає пароль застосунку/);
  assert.match(auth, /DITYAM_GMAIL_APP_PASSWORD/);
  assert.match(auth, /Олімпіада — пароль пошти для сайту/);
  assert.match(mailAlertText('no_password'), /немає пароля застосунку/);
});
