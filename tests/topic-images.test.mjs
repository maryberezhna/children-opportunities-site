import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { TOPIC_LIST, DIASPORA_COUNTRY_TOPICS } from '../lib/topics.js';

const pub = (p) => new URL(`../public${p}`, import.meta.url);

// Правило Марії, 30.09.2026: «у підбірках завжди має бути картинка».
// Привід — /ukrainskym-ditiam-za-kordonom без фото: хіро малювався в одну
// колонку, а в соцмережах сторінка віддавала загальну заставку сайту замість
// своєї (heroImage слугує ще й OG-зображенням, див. topicMetadata).
test('кожна підбірка має зображення обома мовами', () => {
  for (const t of TOPIC_LIST) {
    assert.ok(t.heroImage?.src, `${t.slug}: немає heroImage`);
    assert.ok(t.heroImage.alt?.length > 10, `${t.slug}: порожній alt`);
    assert.ok(t.en?.heroImage?.src, `${t.slug}: немає heroImage в англійській версії`);
    assert.ok(t.en.heroImage.alt?.length > 10, `${t.slug}: порожній alt англійською`);
  }
});

// Шлях без розширення: сторінка сама підставляє .webp і .jpg. Якщо файлу
// немає, браузер із підтримкою webp покаже порожнє місце — і жодна збірка
// про це не скаже.
test('файли зображень існують в обох форматах', () => {
  const seen = new Set();
  for (const t of TOPIC_LIST) {
    for (const src of [t.heroImage.src, t.en.heroImage.src]) {
      if (seen.has(src)) continue;
      seen.add(src);
      for (const ext of ['.jpg', '.webp']) {
        const file = pub(`${src}${ext}`);
        assert.ok(existsSync(file), `${t.slug}: немає public${src}${ext}`);
        assert.ok(statSync(file).size > 10_000, `${t.slug}: ${src}${ext} підозріло малий`);
      }
    }
  }
});

test('англійський alt не збігається з українським', () => {
  for (const t of TOPIC_LIST) {
    assert.notEqual(t.en.heroImage.alt, t.heroImage.alt, `${t.slug}: alt не перекладено`);
  }
});

// Сторінки країн діаспори — теж підбірки, і картинка в них теж має бути.
test('сторінки країн мають зображення', () => {
  for (const t of DIASPORA_COUNTRY_TOPICS) {
    assert.ok(t.heroImage?.src, `${t.slug}: немає heroImage`);
  }
});
