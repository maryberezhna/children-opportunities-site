import { createElement as h } from 'react';

/**
 * Обкладинка сайту для соцмереж і месенджерів — 1200×630.
 *
 * Живе окремо від маршруту, бо потрібна у двох місцях: app/opengraph-image.js
 * рендерить її на льоту з живими числами, а scripts/build-og-image.mjs — у
 * public/og-image.png, який віддається на /press як завантажуваний файл і
 * стоїть в openGraph тематичних, міських і службових сторінок.
 *
 * Без JSX навмисно: скрипт для public/og-image.png — звичайний node,
 * без збирача, а компонент має бути той самий, інакше дві обкладинки знову
 * розійдуться, як розійшлися числа.
 *
 * Попередня версія була статичним PNG, намальованим руками, і застрягла на
 * «265+ перевірених можливостей» — на момент заміни в базі було 690. Тому
 * числа тут ЗАВЖДИ приходять ззовні, а не вписані в розмітку.
 */

const INK = '#1a1a1a';
const ACCENT = '#e85d24';
const MUTED = '#555555';

const stat = (value, label) =>
  h('div', { key: label, style: { display: 'flex', flexDirection: 'column', gap: 2 } }, [
    h('div', {
      key: 'v',
      style: { display: 'flex', fontSize: 52, fontWeight: 700, color: ACCENT, letterSpacing: '-0.02em' },
    }, value),
    h('div', {
      key: 'l',
      style: { display: 'flex', fontSize: 22, fontWeight: 500, color: MUTED },
    }, label),
  ]);

export function ogCard({ opportunities, sources }) {
  return h('div', {
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '64px 72px',
      backgroundColor: '#fefcf7',
      // Кінцевий стоп — колір фону з alpha 0, а не `transparent`: satori
      // інтерполює `transparent` через чорний і градієнт сіріє.
      backgroundImage:
        'radial-gradient(ellipse at top left, #fef2eb 0%, rgba(254,252,247,0) 55%),'
        + 'radial-gradient(ellipse at top right, #e8f4f2 0%, rgba(254,252,247,0) 55%)',
      fontFamily: 'Manrope',
    },
  }, [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: 16 } }, [
      h('div', {
        key: 'domain',
        style: { display: 'flex', fontSize: 26, fontWeight: 700, color: ACCENT, letterSpacing: '-0.02em' },
      }, 'dityam.com.ua'),
      h('div', {
        key: 'chip',
        style: {
          display: 'flex', fontSize: 22, fontWeight: 500, color: '#ffffff',
          backgroundColor: ACCENT, borderRadius: 999, padding: '6px 18px',
        },
      }, 'платформа можливостей'),
    ]),

    h('div', { key: 'body', style: { display: 'flex', flexDirection: 'column', gap: 20 } }, [
      h('div', {
        key: 'title',
        style: {
          display: 'flex', fontSize: 68, fontWeight: 700, color: INK,
          lineHeight: 1.15, letterSpacing: '-0.02em',
        },
      }, 'Усі можливості для дитини — в одному місці'),
      h('div', {
        key: 'sub',
        style: { display: 'flex', fontSize: 26, fontWeight: 500, color: MUTED, lineHeight: 1.4 },
      }, 'Безкоштовні та доступні програми для дітей 0–18 років в Україні й за кордоном. Кожну перевіряємо вручну.'),
    ]),

    h('div', { key: 'stats', style: { display: 'flex', gap: 56 } }, [
      stat(String(opportunities), 'перевірених можливостей'),
      stat(String(sources), 'джерел оновлення'),
      stat('0–18', 'років покриття'),
      stat('0 грн', 'для родин'),
    ]),
  ]);
}
