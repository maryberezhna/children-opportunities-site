import { createElement as h } from 'react';

/**
 * Картинка на екрані до кнопки «Запустити» в @DityamPlusBot — 640×360.
 *
 * Розмір диктує BotFather: він приймає рівно 640×360 і показує це над описом
 * бота, коли людина відкриває його вперше. Це перше, що вона бачить про
 * Dityam+ — раніше за будь-який текст.
 *
 * Чого тут НЕМАЄ і чому (Марія, 27.09.2026: «дескріпшн з цінами, а вони у нас
 * змінюються»):
 *  • цін — вони мінялись двічі за місяць, а картинку в BotFather можна
 *    замінити лише руками, тож вона старіє мовчки й бреше людині;
 *  • чисел бази («695 можливостей») — з тієї ж причини: число росте щодня;
 *  • обіцянки підбирати за містом — її ми не даємо (рішення Марії 22.09.2026).
 *
 * Лишається те, що не псується від часу: що саме людина отримає.
 *
 * Без JSX навмисно — як і lib/og-card.js: рендерить звичайний node-скрипт
 * (scripts/build-bot-image.mjs), без збирача.
 */

const INK = '#1a1a1a';
const ACCENT = '#e85d24';
const MUTED = '#555555';

export function botCard() {
  return h('div', {
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '38px 44px',
      backgroundColor: '#fefcf7',
      // Кінцевий стоп — колір фону з alpha 0, а не `transparent`: satori
      // інтерполює `transparent` через чорний і градієнт сіріє.
      backgroundImage:
        'radial-gradient(ellipse at top left, #fef2eb 0%, rgba(254,252,247,0) 60%),'
        + 'radial-gradient(ellipse at bottom right, #e8f4f2 0%, rgba(254,252,247,0) 60%)',
      fontFamily: 'Manrope',
    },
  }, [
    h('div', { key: 'head', style: { display: 'flex', alignItems: 'center', gap: 12 } }, [
      h('div', {
        key: 'domain',
        style: { display: 'flex', fontSize: 17, fontWeight: 700, color: ACCENT, letterSpacing: '-0.02em' },
      }, 'dityam.com.ua'),
      h('div', {
        key: 'chip',
        style: {
          display: 'flex', fontSize: 15, fontWeight: 700, color: '#ffffff',
          backgroundColor: ACCENT, borderRadius: 999, padding: '4px 14px',
        },
      }, 'Dityam+'),
    ]),

    h('div', { key: 'body', style: { display: 'flex', flexDirection: 'column', gap: 14 } }, [
      h('div', {
        key: 'title',
        style: {
          display: 'flex', fontSize: 42, fontWeight: 700, color: INK,
          lineHeight: 1.12, letterSpacing: '-0.02em',
        },
      }, 'Щодня — те, що підходить саме вашій дитині'),
      h('div', {
        key: 'sub',
        style: { display: 'flex', fontSize: 19, fontWeight: 500, color: MUTED, lineHeight: 1.45 },
      }, 'Конкурси, табори, обміни, стипендії — і нагадування про дедлайн, поки ще є час подати заявку.'),
    ]),

    h('div', {
      key: 'foot',
      style: { display: 'flex', fontSize: 16, fontWeight: 500, color: MUTED },
    }, 'Для дітей 0–18 років · в Україні й за кордоном'),
  ]);
}
