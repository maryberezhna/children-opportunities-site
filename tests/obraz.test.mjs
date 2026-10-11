// Челендж «Намалюй свій образ» і галерея (Марія, 11.10.2026): лише імʼя та
// вік, без прихованих даних у фото, нічого не публікується без «Черги».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  OBRAZ, cleanEntry, firstNameOnly, yearsWord, checkJpeg, stripJpegMetadata, themeOpen,
  caption, buildPublishedMail, buildRejectedMail, validToken, validPublicId,
} = await import('../lib/obraz.js');
const read = (f) => readFileSync(f, 'utf8');

const ok = { name: 'Соломія', age: '9', title: 'Сукня під дощ', story: 'Бо люблю калюжі', email: 'Mama@Example.com', consent: true };

test('лише імʼя: прізвище й зайве відрізаємо', () => {
  assert.equal(firstNameOnly('Соломія Коваленко'), 'Соломія');
  assert.equal(firstNameOnly('  Мар\'яна  '), 'Мар\'яна');
  assert.equal(firstNameOnly('Іван123'), 'Іван');
  assert.equal(cleanEntry({ ...ok, name: 'Соломія Коваленко' }).entry.child_name, 'Соломія');
});

test('заявка: вік 6–17, згода обовʼязкова, Instagram — окремо', () => {
  const { entry } = cleanEntry(ok);
  assert.equal(entry.age, 9);
  assert.equal(entry.parent_email, 'mama@example.com');
  assert.equal(entry.consent_instagram, false);
  assert.equal(cleanEntry({ ...ok, instagram: true }).entry.consent_instagram, true);
  assert.equal(cleanEntry({ ...ok, age: '5' }).error, 'age');
  assert.equal(cleanEntry({ ...ok, age: '18' }).error, 'age');
  assert.equal(cleanEntry({ ...ok, consent: false }).error, 'consent');
  assert.equal(cleanEntry({ ...ok, email: 'ні' }).error, 'email');
  assert.equal(cleanEntry({ ...ok, title: '' }).error, 'title');
  assert.equal(cleanEntry({ ...ok, name: 'А' }).error, 'name');
});

test('підпис під малюнком: «Соломія, 9 років»', () => {
  assert.equal(yearsWord(1), 'рік');
  assert.equal(yearsWord(3), 'роки');
  assert.equal(yearsWord(9), 'років');
  assert.equal(yearsWord(11), 'років');
  assert.equal(yearsWord(12), 'років');
  assert.equal(caption({ child_name: 'Соломія', age: 9 }), 'Соломія, 9 років');
});

// Мінімальний JPEG: SOI, APP0 (JFIF), APP1 з «GPS», COM, SOS + дані, EOI.
const seg = (m, payload) => { const b = Buffer.alloc(4); b[0] = 0xff; b[1] = m; b.writeUInt16BE(payload.length + 2, 2); return Buffer.concat([b, payload]); };
const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  seg(0xe0, Buffer.from('JFIF\0\x01\x01')),
  seg(0xe1, Buffer.from('Exif\0\0GPSLatitude 50.45 GPSLongitude 30.52')),
  seg(0xfe, Buffer.from('comment')),
  seg(0xdb, Buffer.alloc(65, 1)),
  Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0x11, 0x22, 0x33]),
  Buffer.from([0xff, 0xd9]),
]);

test('файл: GPS і коментарі вирізаємо, картинку лишаємо', () => {
  assert.ok(jpeg.includes('GPSLatitude'));
  const clean = stripJpegMetadata(jpeg);
  assert.ok(clean);
  assert.ok(!clean.includes('GPSLatitude'));
  assert.ok(!clean.includes('comment'));
  assert.ok(clean.includes('JFIF'));
  assert.deepEqual([...clean.subarray(-2)], [0xff, 0xd9]);
  assert.equal(stripJpegMetadata(Buffer.from('not a jpeg')), null);
  assert.equal(checkJpeg(jpeg).ok, true);
  assert.equal(checkJpeg(Buffer.from('GIF89a')).error, 'file');
  assert.equal(checkJpeg(Buffer.alloc(OBRAZ.maxBytes + 1, 0xff)).error, 'file_big');
});

test('прийом до останнього дня теми включно', () => {
  assert.equal(themeOpen(OBRAZ.theme.until), true);
  assert.equal(themeOpen('2099-01-01'), false);
});

test('листи батькам: посилання є, email і прізвища немає, без «Dityam+ —»', () => {
  const w = { child_name: 'Соломія', title: 'Сукня під дощ', public_id: 'abcdef0123', token: 'a'.repeat(32), award: 'Найкраща історія', parent_email: 'mama@example.com' };
  const env = { site: 'https://dityam.com.ua', from: 'hellodityam.com.ua@gmail.com' };
  const pub = buildPublishedMail(w, env);
  assert.match(pub.html, /https:\/\/dityam\.com\.ua\/obraz\/r\/abcdef0123/);
  assert.match(pub.html, /\/obraz\/sertyfikat\?t=a{32}/);
  assert.match(pub.html, /\/obraz\/prybraty\?t=a{32}/);
  assert.match(pub.text, /Найкраща історія/);
  const rej = buildRejectedMail(w, env);
  for (const m of [pub, rej]) {
    assert.ok(!m.html.includes('mama@example.com'));
    assert.doesNotMatch(m.text + m.html, /Dityam\+ —/);
  }
});

test('адреси: токен і короткий id — лише hex', () => {
  assert.equal(validToken('a'.repeat(32)), true);
  assert.equal(validToken('../etc'), false);
  assert.equal(validPublicId('abcdef0123'), true);
  assert.equal(validPublicId('abcdef012'), false);
});

test('нічого не публікується само; приватне не йде на сайт', () => {
  const submit = read('app/api/obraz/submit/route.js');
  assert.match(submit, /stripJpegMetadata/);
  assert.doesNotMatch(submit, /status:\s*'approved'/);
  const server = read('lib/obraz-server.js');
  const pub = server.match(/PUBLIC_FIELDS = '([^']+)'/)[1];
  for (const f of ['parent_email', 'token', 'consent']) assert.ok(!pub.includes(f), f);
  // Прибрати — лише POST із кнопки: поштові сканери відкривають посилання самі.
  assert.doesNotMatch(read('app/api/obraz/remove/route.js'), /export async function GET/);
  // Сторінки окремих малюнків — noindex.
  assert.match(read('app/obraz/r/[id]/page.js'), /index: false/);
  // Малюнки — у «Черзі», без нової вкладки.
  assert.match(read('app/admin/page.js'), /<ObrazQueue/);
  assert.match(read('app/admin/AdminNav.js'), /obraz_entries/);
  // Таблиця закрита RLS.
  assert.match(read('supabase/migrations/20261011_obraz_gallery.sql'), /enable row level security/);
});
