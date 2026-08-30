import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { countActiveOpportunities, countActiveSources, FALLBACK } from '@/lib/supabase';
import { ogCard } from '@/lib/og-card';

// nodejs (not edge) бо шрифт читаємо з диска — так само, як у картці окремої
// можливості. revalidate добовий: числа ростуть щодня, але не щохвилини.
export const runtime = 'nodejs';
export const revalidate = 86400;

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'dityam.com.ua — платформа можливостей для дітей 0–18 років';

// Satori не вміє woff2, тож у репо лежать саме ttf з кириличним сабсетом.
const fontDir = path.join(process.cwd(), 'public', 'fonts');
let fontCache = null;
async function fonts() {
  if (!fontCache) {
    const [medium, bold] = await Promise.all([
      readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
      readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
    ]);
    fontCache = [
      { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
      { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
    ];
  }
  return fontCache;
}

export default async function Image() {
  const [opportunities, sources] = await Promise.all([
    countActiveOpportunities(),
    countActiveSources(),
  ]);

  return new ImageResponse(
    ogCard({
      opportunities: opportunities ?? FALLBACK.opportunities,
      sources: sources ?? FALLBACK.sources,
    }),
    { ...size, fonts: await fonts() },
  );
}
