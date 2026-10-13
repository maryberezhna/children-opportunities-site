import { createElement as h } from 'react';
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OLIMP_OPEN, OLIMP_PUBLIC } from './olimpiada.js';
import { MK } from './modnyi-kod.js';

/**
 * Прев'ю «Наших можливостей» (/nashi-mozhlyvosti) для соцмереж — 1200×630.
 * Біле тло, лого — Caveat помаранчевим, перше речення — слова Марії,
 * пігулки — назви самих продуктів. Без ілюстрацій і емблем.
 */
const INK = '#1a1a1a';
const ACCENT = '#c8501a';
const MUTED = '#4a4a4a';

const fontDir = path.join(process.cwd(), 'public', 'fonts');
let fontCache = null;
async function fonts() {
  if (!fontCache) {
    const [medium, bold, caveat] = await Promise.all([
      readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
      readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
      readFile(path.join(fontDir, 'Caveat-Bold.ttf')),
    ]);
    fontCache = [
      { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
      { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
      { name: 'Caveat', data: caveat, weight: 700, style: 'normal' },
    ];
  }
  return fontCache;
}

export const OWN_OG_SIZE = { width: 1200, height: 630 };

function card() {
  const chips = [
    ...(OLIMP_OPEN || OLIMP_PUBLIC ? [['Олімпіада з логіки', '#ede8f8', '#4c3d8c']] : []),
    [`«${MK.title}»`, '#fbd4e0', '#8a1a3a'],
    ['Dityam+', '#fadfd3', ACCENT],
  ];
  return h('div', {
    style: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', padding: '60px 72px', backgroundColor: '#ffffff', fontFamily: 'Manrope',
    },
  }, [
    h('div', { key: 'logo', style: { display: 'flex', fontFamily: 'Caveat', fontSize: 52, fontWeight: 700, color: '#e85d24' } }, 'dityam.com.ua'),
    h('div', { key: 'body', style: { display: 'flex', flexDirection: 'column', gap: 18 } }, [
      h('div', { key: 't', style: { display: 'flex', alignItems: 'baseline', gap: 22 } }, [
        h('div', { key: 'a', style: { display: 'flex', fontSize: 92, fontWeight: 700, color: INK, letterSpacing: '-0.03em' } }, 'Наші'),
        h('div', { key: 'b', style: { display: 'flex', fontFamily: 'Caveat', fontSize: 112, fontWeight: 700, color: ACCENT } }, 'можливості'),
      ]),
      h('div', { key: 's', style: { display: 'flex', fontSize: 32, fontWeight: 500, color: MUTED } },
        'Ми не тільки збираємо можливості для дітей, а й створюємо свої.'),
    ]),
    h('div', { key: 'chips', style: { display: 'flex', gap: 14 } },
      chips.map(([t, bg, ink]) => h('div', {
        key: t,
        style: { display: 'flex', fontSize: 28, fontWeight: 700, color: ink, backgroundColor: bg, borderRadius: 999, padding: '10px 26px' },
      }, t))),
  ]);
}

export async function ownOgImage() {
  return new ImageResponse(card(), { ...OWN_OG_SIZE, fonts: await fonts() });
}
