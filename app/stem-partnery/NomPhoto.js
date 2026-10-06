// Фото номінацій у «вирізаних» рамках зі скругленнями й тонкими лінійними
// дудлами у вирізах — за референсом DevFest (Марія, 06.10.2026: «от можна
// якийсь такий ще візуал використати для stem номінації»). Усе в одному SVG
// 600×400: форма, фото й дудли масштабуються разом, тож на телефоні вигляд
// той самий, що й на десктопі.
//
// Фото — Pexels, вільна ліцензія (комерційне використання без згадки автора),
// обрізані до 3:2, 1200×800: nom-code — pexels.com/photo/4709289,
// nom-robot — pexels.com/photo/7869047, nom-science — pexels.com/photo/8471835.

const W = 600;
const H = 400;
const R = 40; // зовнішні кути
const r = 26; // ввігнуті кути вирізів

// Контур за вершинами за годинниковою стрілкою; кожен кут заокруглений
// квадратичною кривою, тож мʼякі і опуклі, і ввігнуті кути.
function outline(vertices) {
  const n = vertices.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const [px, py] = vertices[(i + n - 1) % n];
    const [vx, vy, radius] = vertices[i];
    const [nx, ny] = vertices[(i + 1) % n];
    const inLen = Math.hypot(vx - px, vy - py);
    const outLen = Math.hypot(nx - vx, ny - vy);
    const rr = Math.min(radius, inLen / 2, outLen / 2);
    const sx = vx + ((px - vx) / inLen) * rr;
    const sy = vy + ((py - vy) / inLen) * rr;
    const ex = vx + ((nx - vx) / outLen) * rr;
    const ey = vy + ((ny - vy) / outLen) * rr;
    d += `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)} ${sy.toFixed(1)} Q${vx} ${vy} ${ex.toFixed(1)} ${ey.toFixed(1)} `;
  }
  return `${d}Z`;
}

// Три форми, як три фото в референсі: вирізи вгорі ліворуч і внизу праворуч;
// лише вгорі праворуч; знову ліворуч/праворуч, але інших розмірів.
const SHAPES = [
  [[176, 0, R], [W, 0, R], [W, H - 100, R], [W - 150, H - 100, r], [W - 150, H, R], [0, H, R], [0, 100, R], [176, 100, r]],
  [[0, 0, R], [W - 120, 0, R], [W - 120, 90, r], [W, 90, R], [W, H, R], [0, H, R]],
  [[120, 0, R], [W, 0, R], [W, H - 96, R], [W - 190, H - 96, r], [W - 190, H, R], [0, H, R], [0, 110, R], [120, 110, r]],
];

// Дудли у вирізах: хвилька зі стрілкою і [✳], //, «;» і три кільця.
const DOODLES = [
  <g key="a">
    <path d="M12 52c8-24 20-24 28 0s20 24 28 0 20-24 28 0" />
    <path d="M112 52h50M150 40l12 12-12 12" />
    <path d="M478 318h-10v64h10M572 318h10v64h-10" />
    <path d="M503 350h44M514 331l22 38M536 331l-22 38" />
  </g>,
  <g key="b">
    <path d="M498 72l24-54M538 72l24-54" />
  </g>,
  <g key="c">
    <circle cx="60" cy="36" r="9" />
    <circle cx="60" cy="76" r="9" />
    <path d="M67 82c2 12-5 20-14 24" />
    <circle cx="470" cy="352" r="17" />
    <circle cx="505" cy="352" r="17" />
    <circle cx="540" cy="352" r="17" />
  </g>,
];

export default function NomPhoto({ index, src, alt }) {
  const shape = SHAPES[index % SHAPES.length];
  const id = `st-nom-clip-${index}`;
  return (
    <svg className="st-nom-photo" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={alt}>
      <defs>
        <clipPath id={id}><path d={outline(shape)} /></clipPath>
      </defs>
      <image href={src} width={W} height={H} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
      <g fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {DOODLES[index % DOODLES.length]}
      </g>
    </svg>
  );
}
