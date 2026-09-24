import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin, adminName, adminConfigured, adminAccounts } from '../lib/adminAuth.js';

// Другий адміністратор зʼявився 24.09.2026: чергу схвалення розбирає не лише
// Марія. Кожен вхід — окремий токен, тож перевіряємо саме це: обидва пускають,
// імена не плутаються, а відкликання одного не чіпає іншого.

const withEnv = (vars, fn) => {
  const saved = { ...process.env };
  Object.assign(process.env, vars);
  try {
    fn();
  } finally {
    for (const k of Object.keys(vars)) delete process.env[k];
    Object.assign(process.env, saved);
  }
};

test('обидва токени відкривають адмінку', () => {
  withEnv({ ADMIN_TOKEN: 'perший-довгий-секрет', ADMIN_TOKEN_2: 'другий-довгий-секрет' }, () => {
    assert.equal(isAdmin('perший-довгий-секрет'), true);
    assert.equal(isAdmin('другий-довгий-секрет'), true);
    assert.equal(isAdmin('чужий'), false);
  });
});

test('імена не плутаються — у журналі видно, хто саме', () => {
  withEnv({
    ADMIN_TOKEN: 'a-secret', ADMIN_TOKEN_NAME: 'Марія',
    ADMIN_TOKEN_2: 'b-secret', ADMIN_TOKEN_2_NAME: 'Оксана',
  }, () => {
    assert.equal(adminName('a-secret'), 'Марія');
    assert.equal(adminName('b-secret'), 'Оксана');
    assert.equal(adminName('чужий'), null);
  });
});

test('без другого токена лишається один акаунт', () => {
  withEnv({ ADMIN_TOKEN: 'lone-secret', ADMIN_TOKEN_2: '' }, () => {
    assert.equal(adminAccounts().length, 1);
    assert.equal(isAdmin('lone-secret'), true);
    assert.equal(isAdmin(''), false);
  });
});

test('порожні значення не пускають нікого', () => {
  withEnv({ ADMIN_TOKEN: '', ADMIN_TOKEN_2: '' }, () => {
    assert.equal(adminConfigured(), false);
    assert.equal(isAdmin(''), false);
    assert.equal(isAdmin(undefined), false);
    assert.equal(isAdmin(null), false);
    // Порожня кука при порожньому токені — не «збіг».
    assert.equal(adminName(''), null);
  });
});
