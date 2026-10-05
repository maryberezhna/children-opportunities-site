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

// ---------- Призи місяця: малюнки (не фото товарів) ----------
// Космонавт із «цеглинок» — 1 місце.
export function PrizeAstronaut(props) {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true" {...props}>
      <path d="M26 30 l3.4 8 l8.6 .8 l-6.5 5.7 l2 8.5 L26 48.5 l-7.5 4.5 l2 -8.5 l-6.5 -5.7 l8.6 -.8z" fill="#ffc93c" />
      <path d="M172 104 l2.6 6 l6.4 .6 l-4.9 4.3 l1.5 6.3 l-5.6 -3.4 l-5.6 3.4 l1.5 -6.3 l-4.9 -4.3 l6.4 -.6z" fill="#ffc93c" />
      <circle cx="166" cy="34" r="12" fill="#ff9ecb" />
      <ellipse cx="166" cy="35" rx="20" ry="5" fill="none" stroke="#f472d0" strokeWidth="3" transform="rotate(-16 166 35)" />
      <rect x="60" y="72" width="80" height="60" rx="10" fill="#c9d4ea" />
      <rect x="74" y="126" width="24" height="36" rx="6" fill="#fff" stroke="#16307a" strokeWidth="3" />
      <rect x="102" y="126" width="24" height="36" rx="6" fill="#fff" stroke="#16307a" strokeWidth="3" />
      <rect x="69" y="154" width="33" height="14" rx="6" fill="#f5a023" stroke="#16307a" strokeWidth="3" />
      <rect x="98" y="154" width="33" height="14" rx="6" fill="#f5a023" stroke="#16307a" strokeWidth="3" />
      <path d="M68 86 q-22 -4 -30 -24" fill="none" stroke="#16307a" strokeWidth="19" strokeLinecap="round" />
      <path d="M68 86 q-22 -4 -30 -24" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
      <path d="M132 92 q18 6 24 22" fill="none" stroke="#16307a" strokeWidth="19" strokeLinecap="round" />
      <path d="M132 92 q18 6 24 22" fill="none" stroke="#fff" strokeWidth="13" strokeLinecap="round" />
      <circle cx="37" cy="59" r="10" fill="#f5a023" stroke="#16307a" strokeWidth="3" />
      <circle cx="157" cy="117" r="10" fill="#f5a023" stroke="#16307a" strokeWidth="3" />
      <rect x="66" y="74" width="68" height="58" rx="10" fill="#fff" stroke="#16307a" strokeWidth="3" />
      <rect x="82" y="92" width="36" height="20" rx="5" fill="#2a5cc0" />
      <circle cx="91" cy="102" r="3.4" fill="#ffc93c" />
      <circle cx="100" cy="102" r="3.4" fill="#ff6b6b" />
      <circle cx="109" cy="102" r="3.4" fill="#7be0a3" />
      <rect x="80" y="8" width="16" height="10" rx="3" fill="#fff" stroke="#16307a" strokeWidth="3" />
      <rect x="104" y="8" width="16" height="10" rx="3" fill="#fff" stroke="#16307a" strokeWidth="3" />
      <rect x="60" y="16" width="80" height="64" rx="24" fill="#fff" stroke="#16307a" strokeWidth="3" />
      <rect x="72" y="30" width="56" height="36" rx="15" fill="#1d3f94" />
      <path d="M82 40 q10 -6 22 -3" fill="none" stroke="#8fb0ff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

// Плата micro:bit із сердечком на світлодіодах — 2 місце.
export function PrizeMicrobit(props) {
  const heart = ['01010', '11111', '11111', '01110', '00100'];
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true" {...props}>
      <path d="M150 20 q22 -8 30 12" fill="none" stroke="#ffc93c" strokeWidth="4" strokeLinecap="round" />
      <path d="M160 34 q12 -4 16 8" fill="none" stroke="#ffc93c" strokeWidth="4" strokeLinecap="round" />
      <rect x="24" y="28" width="152" height="124" rx="16" fill="#16223f" stroke="#0b1226" strokeWidth="3" />
      {heart.flatMap((row, y) => row.split('').map((on, x) => (
        <rect key={`${x}-${y}`} x={72 + x * 12} y={46 + y * 12} width="7" height="9" rx="2" fill={on === '1' ? '#ff4d5e' : '#33415f'} />
      )))}
      <circle cx="46" cy="76" r="11" fill="#0b1226" stroke="#8fa3c8" strokeWidth="3" />
      <circle cx="154" cy="76" r="11" fill="#0b1226" stroke="#8fa3c8" strokeWidth="3" />
      <text x="46" y="52" textAnchor="middle" fontSize="13" fontWeight="700" fill="#8fa3c8" fontFamily="Manrope, sans-serif">A</text>
      <text x="154" y="52" textAnchor="middle" fontSize="13" fontWeight="700" fill="#8fa3c8" fontFamily="Manrope, sans-serif">B</text>
      <rect x="24" y="126" width="152" height="26" rx="0" fill="#e2b34a" />
      <path d="M24 136 v0 a16 16 0 0 0 16 16 h120 a16 16 0 0 0 16 -16 v-10 h-152z" fill="#e2b34a" />
      {[44, 72, 100, 128, 156].map((x) => <circle key={x} cx={x} cy="139" r="8" fill="#16223f" />)}
    </svg>
  );
}

// 3D-ручка, що малює кольорову зірку, — 3 місце.
export function PrizePen(props) {
  return (
    <svg viewBox="0 0 200 180" aria-hidden="true" {...props}>
      <path d="M40 150 l18 -44 l-36 -24 l46 -2 l16 -42 l14 42 l46 4 l-36 26 l12 42 l-38 -26z" fill="none" stroke="#ff5fa2" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M22 82 l46 -2" stroke="#ffc93c" strokeWidth="7" strokeLinecap="round" />
      <path d="M68 80 l16 -42 l14 42" fill="none" stroke="#4ec9f0" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" />
      <g transform="rotate(38 150 60)">
        <rect x="120" y="42" width="78" height="34" rx="15" fill="#ffc93c" stroke="#16307a" strokeWidth="3" />
        <rect x="150" y="50" width="26" height="8" rx="4" fill="#16307a" />
        <circle cx="186" cy="59" r="4" fill="#ff6b6b" />
        <path d="M120 48 l-22 11 l22 11z" fill="#f5a023" stroke="#16307a" strokeWidth="3" strokeLinejoin="round" />
        <path d="M98 59 l-12 0" stroke="#16307a" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
