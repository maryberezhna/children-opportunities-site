import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withUtm, tagSiteLinks, tagKeyboard, UTM_CHANNEL, UTM_PLUS_BOT } from '../lib/utm.js';

const CH = { ...UTM_CHANNEL, content: 'new' };

test('додає позначку до сторінки можливості', () => {
  assert.equal(
    withUtm('https://dityam.com.ua/o/ptakh-roku', CH),
    'https://dityam.com.ua/o/ptakh-roku?utm_source=telegram&utm_medium=social&utm_campaign=channel&utm_content=new',
  );
});

test('головна без шляху, наявний query і якір', () => {
  assert.equal(withUtm('https://dityam.com.ua', UTM_PLUS_BOT),
    'https://dityam.com.ua?utm_source=telegram&utm_medium=social&utm_campaign=dityam_plus');
  assert.equal(withUtm('https://dityam.com.ua/konkursy?vik=10#top', UTM_PLUS_BOT),
    'https://dityam.com.ua/konkursy?vik=10&utm_source=telegram&utm_medium=social&utm_campaign=dityam_plus#top');
});

test('не чіпає чужі сайти, адмінку, api і вже позначені адреси', () => {
  for (const url of [
    'https://t.me/DityamPlusBot?start=from_channel',
    'https://send.monobank.ua/jar/F72fDrV2c',
    'https://dityam.com.ua.evil.com/o/x',
    'https://dityam.com.ua/admin/edit/5',
    'https://dityam.com.ua/api/ig-card?slug=x',
    'https://dityam.com.ua/o/x?utm_source=instagram',
  ]) assert.equal(withUtm(url, CH), url);
});

test('у HTML міняє лише href, & екранує як &amp;, видимий текст не чіпає', () => {
  const html = '🔗 <a href="https://dityam.com.ua/o/x">https://dityam.com.ua/o/x</a> · <a href="https://t.me/x">канал</a>';
  assert.equal(tagSiteLinks(html, CH),
    '🔗 <a href="https://dityam.com.ua/o/x?utm_source=telegram&amp;utm_medium=social&amp;utm_campaign=channel&amp;utm_content=new">https://dityam.com.ua/o/x</a> · <a href="https://t.me/x">канал</a>');
});

test('без позначки — текст і кнопки без змін', () => {
  const html = '<a href="https://dityam.com.ua/o/x">x</a>';
  assert.equal(tagSiteLinks(html, null), html);
  const kb = { inline_keyboard: [[{ text: 'Сайт', url: 'https://dityam.com.ua/o/x' }]] };
  assert.equal(tagKeyboard(kb, null), kb);
});

test('кнопки: url на сайт позначено, callback і чужі url — ні', () => {
  const kb = { inline_keyboard: [[
    { text: 'Відкрити', url: 'https://dityam.com.ua/o/x' },
    { text: '👍', callback_data: 'fb:yes:1' },
    { text: 'Бот', url: 'https://t.me/DityamPlusBot' },
  ]] };
  const out = tagKeyboard(kb, UTM_PLUS_BOT);
  assert.equal(out.inline_keyboard[0][0].url,
    'https://dityam.com.ua/o/x?utm_source=telegram&utm_medium=social&utm_campaign=dityam_plus');
  assert.deepEqual(out.inline_keyboard[0][1], kb.inline_keyboard[0][1]);
  assert.equal(out.inline_keyboard[0][2].url, 'https://t.me/DityamPlusBot');
});
