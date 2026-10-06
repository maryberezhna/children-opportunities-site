// Мальовані персонажі й дрібниці сторінки олімпіади. Референс — конкурс
// малюнків noospherespace.art (Марія, 05.10.2026): монстрики замість літер,
// ракети й зірки на синьому. Усе — прості SVG, без картинок і шрифтів.

// Рожевий колючий монстрик — стає літерою «О» в заголовку.
export function MonsterPink(props) {
  const spikes = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return [60 + Math.cos(a) * 40, 60 + Math.sin(a) * 40, 60 + Math.cos(a) * 56, 60 + Math.sin(a) * 56];
  });
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" {...props}>
      {spikes.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1.toFixed(1)} y1={y1.toFixed(1)} x2={x2.toFixed(1)} y2={y2.toFixed(1)} stroke="#f9a8d4" strokeWidth="5" strokeLinecap="round" />
      ))}
      <circle cx="60" cy="60" r="44" fill="#c0267f" />
      <circle cx="60" cy="62" r="36" fill="#f472d0" />
      <path d="M30 34 l-6 -14 l14 8z M90 34 l6 -14 l-14 8z" fill="#5b1f8f" />
      <circle cx="47" cy="56" r="10" fill="#fff" />
      <circle cx="73" cy="56" r="10" fill="#fff" />
      <circle cx="49" cy="58" r="4.5" fill="#1c1c1c" />
      <circle cx="71" cy="58" r="4.5" fill="#1c1c1c" />
      <path d="M46 76 q14 12 28 0" fill="none" stroke="#7a124f" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// Жовтий одноокий монстрик із ріжками — друга «О».
export function MonsterYellow(props) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" {...props}>
      <path d="M26 30 q-12 -14 -4 -24 q6 12 18 14z M94 30 q12 -14 4 -24 q-6 12 -18 14z" fill="#5b1f8f" />
      <ellipse cx="60" cy="64" rx="44" ry="46" fill="#ffc93c" />
      <path d="M30 84 l8 -12 M46 96 l6 -14 M64 98 l4 -14 M82 92 l-2 -14" stroke="#f08a24" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="52" r="18" fill="#fff" />
      <circle cx="62" cy="54" r="8" fill="#1c1c1c" />
      <circle cx="65" cy="51" r="2.5" fill="#fff" />
      <path d="M42 80 q18 16 36 0 q-18 6 -36 0z" fill="#5b1f8f" />
      <path d="M52 84 l4 6 l4 -6 l4 6 l4 -6" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

// Блакитний «динозаврик» — сидить на краю рамки.
export function MonsterBlue(props) {
  return (
    <svg viewBox="0 0 140 120" aria-hidden="true" {...props}>
      <path d="M22 44 l-10 -16 l18 6 l-4 -18 l16 12 l2 -18 l12 16 l8 -16 l6 18" fill="#3b82f6" />
      <path d="M14 92 q-16 -50 36 -56 q64 -8 72 34 q6 34 -44 38 q-40 4 -64 -16z" fill="#4ec9f0" />
      <path d="M50 86 q26 14 52 -4 q-8 26 -34 24 q-14 -2 -18 -20z" fill="#3b82f6" />
      <circle cx="84" cy="56" r="11" fill="#fff" />
      <circle cx="87" cy="57" r="5" fill="#1c1c1c" />
      <path d="M96 74 q10 4 18 -4" fill="none" stroke="#1d3f94" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Rocket(props) {
  return (
    <svg viewBox="0 0 120 120" fill="none" stroke="#bcd0ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M84 20 q16 -4 18 -2 q2 2 -2 18 q-10 28 -40 44 l-20 -20 q16 -30 44 -40z" />
      <circle cx="78" cy="42" r="8" />
      <path d="M40 60 l-18 4 l-6 14 l18 -4 M60 80 l-4 18 l-14 6 l4 -18" />
      <path d="M30 84 q-10 4 -14 20 q16 -4 20 -14" stroke="#ffc93c" />
    </svg>
  );
}

export function Planet(props) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" {...props}>
      <circle cx="60" cy="60" r="30" fill="#ffc93c" />
      <circle cx="50" cy="52" r="5" fill="#f5a623" />
      <circle cx="68" cy="68" r="7" fill="#f5a623" />
      <circle cx="70" cy="48" r="3" fill="#f5a623" />
      <ellipse cx="60" cy="62" rx="52" ry="14" fill="none" stroke="#ff7a45" strokeWidth="5" transform="rotate(-18 60 60)" />
    </svg>
  );
}

export function Star(props) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" {...props}>
      <path d="M20 3 l4.6 11 l11.9 1 l-9 7.8 l2.8 11.6 L20 28.2 L9.7 34.4 l2.8 -11.6 l-9 -7.8 l11.9 -1z" fill="#ffc93c" />
    </svg>
  );
}

// Хвилястий край синьої секції — як мальований пензлем.
export function Wave({ flip = false, ...props }) {
  return (
    <svg viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true" style={flip ? { transform: 'scaleY(-1)' } : undefined} {...props}>
      <path d="M0 60 V30 q50 -32 100 0 q70 24 140 0 q55 -36 110 0 q65 20 130 0 q60 -28 120 0 q50 32 100 0 q70 -24 140 0 q60 28 120 0 q55 -36 110 0 q65 20 130 0 q60 -28 120 0 q60 24 120 0 V60z" fill="currentColor" />
    </svg>
  );
}
