import { createElement as h } from 'react';
import { PLUS_SALES_OPEN } from './plus.js';
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Прев'ю Dityam+ для соцмереж і месенджерів — 1200×630.
 *
 * До 14.09.2026 сторінка /plus брала обкладинку головної, і посилання на
 * підписку в Telegram виглядало як «Усі можливості для дитини — в одному
 * місці». Тут — лише те, що підписка справді робить, і ціна з тарифу.
 */

const INK = '#1a1a1a';
const ACCENT = '#e85d24';
const MUTED = '#555555';

const COPY = {
  uk: {
    chip: PLUS_SALES_OPEN ? 'підписка' : 'підписка · скоро',
    title: 'Можливості для дитини приходять самі',
    sub: 'Добірка під кожну дитину за віком, вподобаннями й містом і нагадування про дедлайни — у Telegram.',
    stats: [['99 грн', 'на місяць'], ['999 грн', 'на рік'], ['за 4 тижні', 'нагадування про стипендії']],
  },
  en: {
    chip: PLUS_SALES_OPEN ? 'subscription' : 'subscription · soon',
    title: 'Opportunities for your child come to you',
    sub: 'A selection for each child by age, interests and city, plus deadline reminders — on Telegram.',
    stats: [['UAH 119', 'a month'], ['UAH 999', 'a year'], ['4 weeks ahead', 'scholarship reminders']],
  },
};

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

export const PLUS_OG_SIZE = { width: 1200, height: 630 };

function card(lang) {
  const c = COPY[lang] || COPY.uk;
  return h('div', {
    style: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between', padding: '64px 72px', backgroundColor: '#fefcf7',
      backgroundImage:
        'radial-gradient(ellipse at top left, #fef2eb 0%, rgba(254,252,247,0) 55%),'
        + 'radial-gradient(ellipse at top right, #e8f4f2 0%, rgba(254,252,247,0) 55%)',
      fontFamily: 'Manrope',
    },
  }, [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: 16 } }, [
      h('div', { key: 'brand', style: { display: 'flex', fontSize: 30, fontWeight: 700, color: ACCENT } }, 'Dityam+'),
      h('div', {
        key: 'chip',
        style: {
          display: 'flex', fontSize: 22, fontWeight: 500, color: '#ffffff',
          backgroundColor: ACCENT, borderRadius: 999, padding: '6px 18px',
        },
      }, c.chip),
      h('div', { key: 'domain', style: { display: 'flex', fontSize: 24, fontWeight: 500, color: MUTED, marginLeft: 'auto' } }, 'dityam.com.ua/plus'),
    ]),
    h('div', { key: 'body', style: { display: 'flex', flexDirection: 'column', gap: 20 } }, [
      h('div', {
        key: 'title',
        style: { display: 'flex', fontSize: 70, fontWeight: 700, color: INK, lineHeight: 1.12, letterSpacing: '-0.02em' },
      }, c.title),
      h('div', { key: 'sub', style: { display: 'flex', fontSize: 28, fontWeight: 500, color: MUTED, lineHeight: 1.4 } }, c.sub),
    ]),
    h('div', { key: 'stats', style: { display: 'flex', gap: 56 } },
      c.stats.map(([v, l]) => h('div', { key: l, style: { display: 'flex', flexDirection: 'column', gap: 2 } }, [
        h('div', { key: 'v', style: { display: 'flex', fontSize: 46, fontWeight: 700, color: ACCENT } }, v),
        h('div', { key: 'l', style: { display: 'flex', fontSize: 22, fontWeight: 500, color: MUTED } }, l),
      ]))),
  ]);
}

export async function plusOgImage(lang) {
  return new ImageResponse(card(lang), { ...PLUS_OG_SIZE, fonts: await fonts() });
}
