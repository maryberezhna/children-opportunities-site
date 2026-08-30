// Перемальовує public/og-image.png — статичну обкладинку, яку віддає /press
// і на яку посилаються тематичні, міські та службові сторінки.
//
// Навіщо скрипт, якщо є app/opengraph-image.js: маршрут рендериться на сервері
// й живе за URL, а на /press потрібен файл, який людина завантажить. Розмітка
// в обох одна (lib/og-card.js), тож картинки не розійдуться.
//
// Числа беруться з бази, якщо в оточенні є ключі Supabase; інакше передаються
// руками — саме так і сталося з попередньою обкладинкою, яка застрягла на
// «265+», коли в базі було 690:
//
//   node scripts/build-og-image.mjs --opportunities 690 --sources 213
import { ImageResponse } from 'next/og.js';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ogCard } from '../lib/og-card.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
};

const opportunities = arg('opportunities');
const sources = arg('sources');
if (!opportunities || !sources) {
  console.error('Вкажіть числа: --opportunities 690 --sources 213');
  process.exit(1);
}

const fontDir = path.join(process.cwd(), 'public', 'fonts');
const [medium, bold] = await Promise.all([
  readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
  readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
]);

const image = new ImageResponse(ogCard({ opportunities, sources }), {
  width: 1200,
  height: 630,
  fonts: [
    { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
    { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
  ],
});

const out = path.join(process.cwd(), 'public', 'og-image.png');
await writeFile(out, Buffer.from(await image.arrayBuffer()));
console.log(`Готово: ${out} (${opportunities} можливостей, ${sources} джерел)`);
