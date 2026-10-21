// 21.10.2026: бот умикав безкоштовний Dityam+ з billing_period = 'free', а CHECK у базі
// знав лише monthly/yearly/halfyear/gift — PATCH падав з 400, бот писав «увімкнено»,
// а статус лишався pending (15 людей за день). Міграція дозволяє 'free'; cron
// «застряг на оплаті» мовчить, поки Dityam+ безкоштовний.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('billing_period free: дозволений міграцією, cron і кнопка анкети знають про безкоштовний режим', () => {
  assert.match(read('supabase/migrations/20261021_billing_period_free.sql'), /'free'::text/);
  assert.match(read('app/api/telegram/plus/route.js'), /billing_period: 'free'/);
  const cron = read('app/api/cron/nudge-stuck/route.js');
  assert.match(cron, /PLUS_FREE && stage === 'pay' \? null/);
  assert.match(read('app/api/telegram/plus/route.js'), /PLUS_FREE \? '✅ Так, усе правильно'/);
});
