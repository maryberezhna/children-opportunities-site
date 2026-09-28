// Малює public/bot/plus-description.png — картинку на екран до кнопки
// «Запустити» в @DityamPlusBot (640×360, розмір диктує BotFather).
//
// Поставити її може лише людина: API на це методу не має, тільки BotFather
// (/mybots → Edit Bot → Edit Description Picture). Тому скрипт кладе файл у
// public/, а Марія завантажує його в BotFather.
//
//   node scripts/build-bot-image.mjs
import { ImageResponse } from 'next/og.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { botCard } from '../lib/bot-card.js';

const fontDir = path.join(process.cwd(), 'public', 'fonts');
const [medium, bold] = await Promise.all([
  readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
  readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
]);

const image = new ImageResponse(botCard(), {
  width: 640,
  height: 360,
  fonts: [
    { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
    { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
  ],
});

const dir = path.join(process.cwd(), 'public', 'bot');
await mkdir(dir, { recursive: true });
const out = path.join(dir, 'plus-description.png');
await writeFile(out, Buffer.from(await image.arrayBuffer()));
console.log(`Готово: ${out}`);
