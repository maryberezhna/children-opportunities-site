import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Тригер підказки «Давайте бути на звʼязку» рахує переглянуті картки через
 * querySelectorAll(CARD_SELECTOR). Селектор і розмітка живуть у різних файлах,
 * і одного разу вони вже розійшлися: редизайн перейменував '.card' на
 * 'v2-card' та 'tp-card', тригер перестав спрацьовувати — і мовчав, бо
 * querySelectorAll на неіснуючий клас не помиляється, а просто дає нуль.
 * За 14 днів усі 1 896 показів дав інший тригер (повернення від організатора).
 *
 * Тест звіряє обидва боки: клас досі в розмітці списку І досі в селекторі.
 * Новий список карток — новий рядок тут і в CARD_SELECTOR.
 */
const LISTS = [
  ['app/OpportunitiesList.js', 'v2-card'],   // головна, міські сторінки
  ['app/topic/TopicCards.js', 'tp-card'],    // тематичні підбірки
  ['app/o/shared.js', 'card'],               // «схожі можливості»
];

const popup = readFileSync(new URL('../app/SubscribePopup.js', import.meta.url), 'utf8');
const selector = (popup.match(/const CARD_SELECTOR = '([^']+)'/) || [])[1];
const classes = (selector || '').split(',').map((s) => s.trim().replace(/^\./, ''));

test('селектор карток у підказці існує', () => {
  assert.ok(selector, 'у SubscribePopup.js немає CARD_SELECTOR');
});

for (const [file, cls] of LISTS) {
  test(`картки ${file} мають клас «${cls}» — і він є в селекторі підказки`, () => {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.ok(
      src.includes(`className="${cls}"`),
      `${file} більше не ставить className="${cls}" — онови LISTS і CARD_SELECTOR`,
    );
    assert.ok(
      classes.includes(cls),
      `CARD_SELECTOR не бачить «${cls}» — тригер «15 карток» на цьому списку не спрацює`,
    );
  });
}
