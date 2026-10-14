// Нагорода біля логотипа (Марія, 07.10.2026: «на сайт треба додати
// переможець SIA Ukraine 2026 … біля логотипу, щоб видимо й легко читати»).
//
// href — прес-реліз SIA Ukraine про переможців 2026 (08.10.2026; Марія,
// 14.10.2026: «заміни на сайті посилання на оце»). Головна й «Модний код»
// беруть адресу лише звідси.
export const SIA_AWARD = {
  href: 'https://ukraine.socialimpactaward.net/article/%d0%ba%d1%96%d0%b1%d0%b5%d1%80%d0%b1%d0%b5%d0%b7%d0%bf%d0%b5%d0%ba%d0%b0-%d0%b4%d0%bb%d1%8f-%d0%bf%d1%96%d0%b4%d0%bb%d1%96%d1%82%d0%ba%d1%96%d0%b2-%d0%bc%d0%be%d0%b6%d0%bb%d0%b8%d0%b2%d0%be%d1%81/',
  short: { uk: 'Переможець SIA Ukraine 2026', en: 'SIA Ukraine 2026 winner' },
  // Текст по колу наліпки на кінці заголовка головної (обертається).
  ring: { uk: 'ПЕРЕМОЖЕЦЬ • SIA UKRAINE 2026 • ', en: 'WINNER • SIA UKRAINE 2026 • ' },
  full: {
    uk: 'Переможець Social Impact Award Ukraine 2026 — вибір журі',
    en: 'Winner of Social Impact Award Ukraine 2026 — jury’s choice',
  },
};

// Приблизна ширина символу в em для жирного Manrope у верхньому регістрі.
// Рівний крок по колу («кожній літері однаковий кут») давав злиплі Ж і М і
// діри навколо пробілів і крапок — Марія: «не дуже читабельно».
const WIDE = new Set([...'ЖЩШМЮФWM']);
const NARROW = { ' ': 0.32, '•': 0.45, 'I': 0.32, '1': 0.5 };
const glyphWidth = (ch) => NARROW[ch] ?? (WIDE.has(ch) ? 0.95 : /\d/.test(ch) ? 0.62 : 0.72);

/**
 * Кут (у градусах) для центру кожного символу тексту по колу: крок пропорційний
 * ширині символу, а весь текст рівно на один оберт.
 * @returns {{ ch: string, deg: number }[]}
 */
export function ringLayout(text) {
  const chars = [...text];
  const widths = chars.map(glyphWidth);
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return chars.map((ch, i) => {
    const deg = ((acc + widths[i] / 2) / total) * 360;
    acc += widths[i];
    return { ch, deg: Math.round(deg * 10) / 10 };
  });
}
