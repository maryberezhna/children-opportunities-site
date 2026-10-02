import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isForeignTelegram, sourceProblem } from '../lib/source-rules.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

// Правило Марії 27.09.2026: чужий Telegram-канал не показуємо ніколи. Правило
// було, масовий прохід 28.09 прибрав 125 записів — а перевірки в коді не
// існувало, і 01.10.2026 на сайті знову висіли три такі записи.
test('чужий Telegram — не джерело', () => {
  for (const u of ['https://t.me/tviyspace/11901', 'https://t.me/Mozhlyvosti/10646',
                   'https://telegram.me/grants_ukraine/788', 't.me/someone/1']) {
    assert.equal(isForeignTelegram(u), true, u);
  }
});

test('сторінка організатора — джерело', () => {
  for (const u of ['https://man.gov.ua/news', 'https://aiesec.ua/', 'https://smartfuture.org.ua/',
                   '', null, undefined]) {
    assert.equal(isForeignTelegram(u), false, String(u));
  }
});

// Наш власний канал джерелом не буває, але й порушенням не є: посилання на
// нього стоять у текстах сайту.
test('наш канал не вважається порушенням', () => {
  assert.equal(isForeignTelegram('https://t.me/dityam_com_ua'), false);
  assert.equal(isForeignTelegram('https://t.me/DityamPlusBot?start=site'), false);
});

test('причина називається словами', () => {
  assert.match(sourceProblem({ source_url: 'https://t.me/x/1' }), /Telegram/);
  assert.equal(sourceProblem({ source_url: 'https://aiesec.ua/' }), '');
});

// Перевірка має стояти на ВСІХ шляхах публікації — саме відсутність виклику й
// була дірою. 02.10.2026 виявилось, що шляхів чотири, а не два: кнопка в боті
// й редактор джерело не питали, і на сайт зайшли пʼять записів із чужим
// каналом. Тепер правило кличуть через lib/publish-gate.js, а повний перелік
// шляхів звіряє tests/publish-gate.test.mjs.
test('шляхи публікації перевіряють джерело через спільні ворота', () => {
  for (const f of ['scripts/publish-draft.mjs', 'app/api/admin/review/route.js',
                   'app/api/admin/edit/route.js', 'app/api/telegram/webhook/route.js']) {
    const src = read(f);
    assert.ok(/publishBlockers/.test(src), `${f}: джерело не перевіряється`);
    assert.ok(/GATE_SELECT/.test(src), `${f}: поля воріт не читаються з бази — перевірка була б сліпа`);
  }
});
