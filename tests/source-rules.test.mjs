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

// Перевірка має стояти на ОБОХ шляхах публікації — саме відсутність виклику й
// була дірою.
test('обидва шляхи публікації перевіряють джерело', () => {
  for (const f of ['scripts/publish-draft.mjs', 'app/api/admin/review/route.js']) {
    const src = read(f);
    assert.ok(/sourceProblem/.test(src), `${f}: джерело не перевіряється`);
    assert.ok(/source_url/.test(src), `${f}: source_url не читається з бази — перевірка була б сліпа`);
  }
});
