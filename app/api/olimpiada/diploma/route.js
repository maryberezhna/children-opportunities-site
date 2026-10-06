// Диплом онлайн-олімпіади — картинка A4 (альбомна), яку можна зберегти,
// надіслати в Telegram і надрукувати. Справжній диплом малюється з запису в
// базі за токеном, тож «золотий рівень» не підробити зміною адреси.
// ?sample=gold|silver|bronze|participant — зразок без даних для сторінки
// олімпіади: щоб диплом хотілося мати, його треба побачити.
//
// Стиль — як у сторінки олімпіади (Марія, 06.10.2026: «диплом дуже нудний,
// зроби у такому стилі, як сайт»): синє зоряне небо, монстрики, рукописний
// заголовок Caveat, біла картка з медаллю.
//
// v7 (06.10.2026): «паперовий» v6 Марії не сподобався («диплом попередній був
// краще») — повернули хмару з персонажами, але небо в кольорі рівня («фон у
// них має відрізнятися також») і напис рівня рівно, без нахилу.
//
// v8 (06.10.2026): небо золотого рівня мандаринове замість охри — охра
// виглядала брудно-коричневою («жовтий не підходить»); Марія обрала з 6 варіантів.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OLIMP, LEVELS, levelByKey, diplomaNo, diplomaDate } from '@/lib/olimpiada';
import { getStore, validToken } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Запис читаємо свіжим: інакше Data Cache віддає стан «до старту» (#723).
export const fetchCache = 'force-no-store';

const fontDir = path.join(process.cwd(), 'public', 'fonts');
const W = 1240;
const H = 1754;
const BLUE = '#2a5cc0';
const NAVY = '#16307a';

// sky — небо за хмарою: у кожного рівня своє.
const TONES = {
  gold: { main: '#b7791f', deep: '#8a5606', ring: '#f2b93b', shine: '#ffe08a', pill: '#ffc93c', pillInk: NAVY, sky: 'linear-gradient(160deg, #e2570f 0%, #f57f1f 55%, #ffa43d 100%)' },
  silver: { main: '#55687a', deep: '#3f4f5f', ring: '#aab8c6', shine: '#e3eaf1', pill: '#d7dfe8', pillInk: NAVY, sky: 'linear-gradient(160deg, #3b4756 0%, #5d6c7e 55%, #8494a6 100%)' },
  bronze: { main: '#9a5426', deep: '#7c4119', ring: '#d9925c', shine: '#f3c39f', pill: '#f0b07a', pillInk: NAVY, sky: 'linear-gradient(160deg, #5a2410 0%, #87401f 55%, #a85a30 100%)' },
  participant: { main: '#2f66d0', deep: '#1d3f94', ring: '#5b8cf0', shine: '#bcd0ff', pill: '#5b8cf0', pillInk: '#ffffff', sky: 'linear-gradient(160deg, #1d3f94 0%, #2a5cc0 55%, #3b6fd6 100%)' },
};

// Бали у зразках — посередині кожного рівня.
const SAMPLE_SCORE = { gold: 23, silver: 19, bronze: 14, participant: 9 };

// Зірки на небі: сталі координати, щоб диплом щоразу був однаковий.
const STARS = [
  [40, 300, 5], [160, 420, 3], [60, 760, 4], [120, 880, 3], [40, 1200, 5], [150, 1340, 3], [60, 1660, 4],
  [1180, 330, 5], [1080, 430, 3], [1200, 760, 4], [1120, 900, 3], [1190, 1200, 5], [1090, 1360, 3], [1180, 1680, 4],
  [330, 60, 3], [700, 90, 4], [860, 40, 3], [1160, 180, 3], [420, 1700, 3], [980, 1700, 4], [620, 1720, 3],
];

function Sky({ k }) {
  const px = (v) => Math.round(v * k);
  return (
    <svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      {STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#ffffff" opacity={r === 3 ? 0.55 : 0.95} />)}
      <circle cx={1100} cy={600} r={5} fill="#ffc93c" />
      <circle cx={120} cy={1100} r={5} fill="#ffc93c" />
      <circle cx={600} cy={180} r={4} fill="#ff5fa2" />
    </svg>
  );
}

// Рожевий колючий монстрик і жовтий одноокий — ті самі, що на сторінці.
function MonsterPink({ size }) {
  const spikes = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    return [60 + Math.cos(a) * 40, 60 + Math.sin(a) * 40, 60 + Math.cos(a) * 56, 60 + Math.sin(a) * 56];
  });
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {spikes.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f9a8d4" strokeWidth="5" strokeLinecap="round" />)}
      <circle cx="60" cy="60" r="44" fill="#c0267f" />
      <circle cx="60" cy="62" r="36" fill="#f472d0" />
      <path d="M30 34 l-6 -14 l14 8z M90 34 l6 -14 l-14 8z" fill="#5b1f8f" />
      <circle cx="47" cy="56" r="10" fill="#ffffff" />
      <circle cx="73" cy="56" r="10" fill="#ffffff" />
      <circle cx="49" cy="58" r="4.5" fill="#1c1c1c" />
      <circle cx="71" cy="58" r="4.5" fill="#1c1c1c" />
      <path d="M46 76 q14 12 28 0" fill="none" stroke="#7a124f" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function MonsterYellow({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <path d="M26 30 q-12 -14 -4 -24 q6 12 18 14z M94 30 q12 -14 4 -24 q-6 12 -18 14z" fill="#5b1f8f" />
      <ellipse cx="60" cy="64" rx="44" ry="46" fill="#ffc93c" />
      <path d="M30 84 l8 -12 M46 96 l6 -14 M64 98 l4 -14 M82 92 l-2 -14" stroke="#f08a24" strokeWidth="5" strokeLinecap="round" />
      <circle cx="60" cy="52" r="18" fill="#ffffff" />
      <circle cx="62" cy="54" r="8" fill="#1c1c1c" />
      <circle cx="65" cy="51" r="2.5" fill="#ffffff" />
      <path d="M42 80 q18 16 36 0 q-18 6 -36 0z" fill="#5b1f8f" />
      <path d="M52 84 l4 6 l4 -6 l4 6 l4 -6" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

function Rocket({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" stroke="#bcd0ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M84 20 q16 -4 18 -2 q2 2 -2 18 q-10 28 -40 44 l-20 -20 q16 -30 44 -40z" />
      <circle cx="78" cy="42" r="8" />
      <path d="M40 60 l-18 4 l-6 14 l18 -4 M60 80 l-4 18 l-14 6 l4 -18" />
      <path d="M30 84 q-10 4 -14 20 q16 -4 20 -14" stroke="#ffc93c" />
    </svg>
  );
}

function Planet({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="60" r="30" fill="#ffc93c" />
      <circle cx="50" cy="52" r="5" fill="#f5a623" />
      <circle cx="68" cy="68" r="7" fill="#f5a623" />
      <ellipse cx="60" cy="62" rx="52" ry="14" fill="none" stroke="#ff7a45" strokeWidth="5" transform="rotate(-18 60 60)" />
    </svg>
  );
}

function Star({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <path d="M20 3 l4.6 11 l11.9 1 l-9 7.8 l2.8 11.6 L20 28.2 L9.7 34.4 l2.8 -11.6 l-9 -7.8 l11.9 -1z" fill={color} />
    </svg>
  );
}

// Медаль: дві стрічки й коло із зіркою в кольорі рівня.
function Medal({ tone, size }) {
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 200 236">
      <path d="M62 8 h44 l-14 104 h-44z" fill={BLUE} />
      <path d="M138 8 h-44 l14 104 h44z" fill={NAVY} />
      <circle cx="100" cy="150" r="80" fill={tone.ring} />
      <circle cx="100" cy="150" r="64" fill={tone.shine} />
      <circle cx="100" cy="150" r="64" fill="none" stroke={tone.main} strokeWidth="3" />
      <path d="M100 104 l13.5 30 l32.5 3 l-24.5 21.5 l7.5 32 l-29 -17 l-29 17 l7.5 -32 l-24.5 -21.5 l32.5 -3z" fill={tone.main} />
    </svg>
  );
}

// Персонажі з обличчями навколо «хмарки» — як на дитячих дипломах, тільки
// не інструменти, а речі з логічних завдань: робот, гральний кубик, лампочка,
// пазл, годинник, фігури. Усі — прості SVG без картинок.
// Обличчя — масив елементів: ні фрагменти, ні <g> satori всередині SVG не малює.
const face = (cx, cy, r, ink = '#1c1c1c') => [
  <circle key="l" cx={cx - r * 0.35} cy={cy - r * 0.1} r={r * 0.12} fill={ink} />,
  <circle key="r" cx={cx + r * 0.35} cy={cy - r * 0.1} r={r * 0.12} fill={ink} />,
  <path key="m" d={`M ${cx - r * 0.38} ${cy + r * 0.3} q ${r * 0.38} ${r * 0.4} ${r * 0.76} 0`} fill="none" stroke={ink} strokeWidth={r * 0.1} strokeLinecap="round" />,
];
function Robot({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <rect x="22" y="34" width="76" height="66" rx="14" fill="#c9d4ea" stroke={NAVY} strokeWidth="4" />
      <line x1="60" y1="34" x2="60" y2="16" stroke={NAVY} strokeWidth="4" />
      <circle cx="60" cy="12" r="7" fill="#ff5a5f" stroke={NAVY} strokeWidth="3" />
      <rect x="34" y="48" width="52" height="30" rx="10" fill="#ffffff" stroke={NAVY} strokeWidth="3" />
      {face(60, 63, 16)}
      <rect x="8" y="50" width="14" height="30" rx="6" fill="#c9d4ea" stroke={NAVY} strokeWidth="4" />
      <rect x="98" y="50" width="14" height="30" rx="6" fill="#c9d4ea" stroke={NAVY} strokeWidth="4" />
      <rect x="36" y="100" width="16" height="14" rx="4" fill={NAVY} />
      <rect x="68" y="100" width="16" height="14" rx="4" fill={NAVY} />
    </svg>
  );
}
function Die({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <rect x="14" y="14" width="92" height="92" rx="20" fill="#ffffff" stroke={NAVY} strokeWidth="4" transform="rotate(-10 60 60)" />
      <circle cx="40" cy="36" r="8" fill="#ff5a5f" />
      <circle cx="82" cy="38" r="8" fill="#ff5a5f" />
      <circle cx="36" cy="86" r="8" fill="#ff5a5f" />
      <circle cx="86" cy="82" r="8" fill="#ff5a5f" />
      {face(61, 60, 14)}
    </svg>
  );
}
function Bulb({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <path d="M60 10 a34 34 0 0 1 20 61 l-4 12 h-32 l-4 -12 a34 34 0 0 1 20 -61z" fill="#ffc93c" stroke={NAVY} strokeWidth="4" />
      <rect x="44" y="86" width="32" height="10" rx="4" fill="#c9d4ea" stroke={NAVY} strokeWidth="3" />
      <rect x="48" y="98" width="24" height="8" rx="4" fill="#c9d4ea" stroke={NAVY} strokeWidth="3" />
      {face(60, 46, 18)}
      <path d="M14 30 l10 6 M106 30 l-10 6 M60 -2 v8" stroke="#ffc93c" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
function Puzzle({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <path d="M22 30 h26 a10 10 0 0 1 20 0 h26 v26 a10 10 0 0 0 0 20 v26 h-26 a10 10 0 0 1 -20 0 h-26 v-26 a10 10 0 0 1 0 -20z" fill="#7be0a3" stroke={NAVY} strokeWidth="4" />
      {face(58, 66, 16)}
    </svg>
  );
}
function Clock({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx="60" cy="62" r="44" fill="#ffffff" stroke={NAVY} strokeWidth="4" />
      <path d="M60 30 v6 M60 88 v6 M28 62 h6 M86 62 h6" stroke={NAVY} strokeWidth="4" strokeLinecap="round" />
      <path d="M60 62 v-22 M60 62 l16 10" stroke="#ff5a5f" strokeWidth="5" strokeLinecap="round" />
      {face(60, 72, 12)}
      <path d="M36 22 l-10 -8 M84 22 l10 -8" stroke={NAVY} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
function Shape({ size, kind }) {
  const fill = { tri: '#ffc93c', sq: '#2f7df6', circle: '#ff5a5f' }[kind];
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {{
        tri: <path d="M60 14 l50 86 h-100z" fill={fill} stroke={NAVY} strokeWidth="4" strokeLinejoin="round" />,
        sq: <rect x="16" y="16" width="88" height="88" rx="14" fill={fill} stroke={NAVY} strokeWidth="4" />,
        circle: <circle cx="60" cy="60" r="46" fill={fill} stroke={NAVY} strokeWidth="4" />,
      }[kind]}
      {face(60, kind === 'tri' ? 72 : 60, 16, kind === 'sq' ? '#ffffff' : '#1c1c1c')}
    </svg>
  );
}

// Розташування персонажів (портрет 1240×1754): по краях, за «хмаркою».
function Characters({ k }) {
  const px = (n) => Math.round(n * k);
  const put = (x, y, rot, node) => (
    <div key={`${x}-${y}`} style={{ position: 'absolute', left: px(x), top: px(y), display: 'flex', transform: `rotate(${rot}deg)` }}>{node}</div>
  );
  return (
    <>
      {put(70, 70, -8, <MonsterPink size={px(190)} />)}
      {put(980, 60, 10, <MonsterYellow size={px(170)} />)}
      {put(540, 20, 0, <Robot size={px(150)} />)}
      {put(40, 560, -6, <Die size={px(140)} />)}
      {put(1060, 520, 8, <Bulb size={px(150)} />)}
      {put(30, 1000, 6, <Puzzle size={px(150)} />)}
      {put(1050, 980, -8, <Clock size={px(150)} />)}
      {put(70, 1470, 0, <Shape size={px(130)} kind="tri" />)}
      {put(1040, 1450, 6, <Shape size={px(130)} kind="sq" />)}
      {put(560, 1560, 0, <Shape size={px(130)} kind="circle" />)}
      {put(300, 1600, -10, <Rocket size={px(120)} />)}
      {put(800, 1590, 0, <Planet size={px(120)} />)}
    </>
  );
}

// Біла «хмарка»: велика округла картка з опуклостями по краях — як на
// дитячих дипломах (референс Марії, 06.10.2026), але в нашому стилі.
function Cloud({ k }) {
  const px = (n) => Math.round(n * k);
  const bump = (x, y, r) => (
    <div key={`${x}-${y}`} style={{ position: 'absolute', left: px(x - r), top: px(y - r), width: px(r * 2), height: px(r * 2), borderRadius: '50%', backgroundColor: '#ffffff', display: 'flex' }} />
  );
  return (
    <>
      <div style={{ position: 'absolute', left: px(190), top: px(230), width: px(860), height: px(1300), borderRadius: px(120), backgroundColor: '#ffffff', display: 'flex' }} />
      {bump(300, 250, 120)}{bump(520, 210, 130)}{bump(760, 220, 125)}{bump(960, 270, 110)}
      {bump(210, 480, 90)}{bump(1040, 460, 95)}{bump(200, 760, 100)}{bump(1050, 760, 100)}
      {bump(200, 1040, 95)}{bump(1050, 1050, 95)}{bump(230, 1300, 100)}{bump(1020, 1310, 100)}
      {bump(360, 1520, 120)}{bump(620, 1560, 130)}{bump(880, 1520, 120)}
    </>
  );
}

function diploma({ name, levelKey, score, max, date, no, k }) {
  const level = levelByKey(levelKey);
  const tone = TONES[level.key] || TONES.participant;
  const px = (n) => Math.round(n * k);
  const nameSize = name.length > 30 ? 76 : name.length > 22 ? 96 : 118;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: BLUE, fontFamily: 'Manrope',
      backgroundImage: tone.sky }}>
      <Sky k={k} />
      <Cloud k={k} />
      <Characters k={k} />

      <div style={{ position: 'absolute', left: px(250), top: px(300), width: px(740), height: px(1180), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', fontSize: px(22), fontWeight: 700, letterSpacing: '0.22em', color: '#5a72b5' }}>ОНЛАЙН-ОЛІМПІАДА З ЛОГІКИ ·</div>
            <div style={{ display: 'flex', marginLeft: px(12), fontFamily: 'Caveat', fontSize: px(42), fontWeight: 700, color: '#e85d24', lineHeight: 1 }}>dityam.com.ua</div>
          </div>
          <div style={{ display: 'flex', marginTop: px(14), fontSize: px(168), fontWeight: 700, letterSpacing: '0.04em', color: '#e85d24', lineHeight: 1 }}>ДИПЛОМ</div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: px(18) }}>
            <div style={{ display: 'flex' }}><Medal tone={tone} size={px(120)} /></div>
            <div style={{ display: 'flex', marginLeft: px(18), fontSize: px(40), fontWeight: 700, color: tone.pillInk, backgroundColor: tone.pill, borderRadius: 999, padding: `${px(12)}px ${px(44)}px` }}>
              {level.key === 'participant' ? 'учасника олімпіади' : level.label}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: px(26), fontWeight: 700, letterSpacing: '0.18em', color: '#5a72b5' }}>НАГОРОДЖУЄТЬСЯ</div>
          <div style={{ display: 'flex', marginTop: px(10), fontFamily: 'Caveat', fontSize: px(nameSize), fontWeight: 700, color: '#1d3f94', lineHeight: 1.05 }}>{name}</div>
          <div style={{ display: 'flex', marginTop: px(22), fontSize: px(28), fontWeight: 500, color: '#2c4a9a', lineHeight: 1.4 }}>
            {`за участь в онлайн-олімпіаді з логіки для дітей ${OLIMP.groupLabel}`}
          </div>
          <div style={{ display: 'flex', marginTop: px(14), fontFamily: 'Caveat', fontSize: px(66), fontWeight: 700, color: '#f5a023' }}>
            {`Результат: ${score} з ${max} балів`}
          </div>
        </div>

        <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', justifyContent: 'space-between', padding: `0 ${px(40)}px` }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', fontSize: px(20), fontWeight: 700, letterSpacing: '0.18em', color: '#5a72b5' }}>ДАТА</div>
            <div style={{ display: 'flex', marginTop: px(6), fontSize: px(24), fontWeight: 700, color: NAVY }}>{date}</div>
            <div style={{ display: 'flex', marginTop: px(4), fontSize: px(20), fontWeight: 500, color: '#8a98c4' }}>{no}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: px(20), fontWeight: 700, letterSpacing: '0.18em', color: '#5a72b5' }}>ПІДПИС</div>
            <div style={{ display: 'flex', marginTop: px(2), fontFamily: 'Caveat', fontSize: px(44), fontWeight: 700, color: NAVY }}>Марія Шутяк</div>
            <div style={{ display: 'flex', fontSize: px(20), fontWeight: 500, color: '#5a72b5' }}>засновниця Dityam.com.ua</div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function render(data, { k = 1, headers = {} } = {}) {
  const [medium, bold, hand] = await Promise.all([
    readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
    readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
    readFile(path.join(fontDir, 'Caveat-Bold.ttf')),
  ]);
  const image = new ImageResponse(diploma({ ...data, k }), {
    width: Math.round(W * k),
    height: Math.round(H * k),
    fonts: [
      { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
      { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
      { name: 'Caveat', data: hand, weight: 700, style: 'normal' },
    ],
  });
  const out = new Headers(image.headers);
  for (const [key, value] of Object.entries(headers)) out.set(key, value);
  return new Response(image.body, { status: 200, headers: out });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const sample = searchParams.get('sample');
  if (sample) {
    const level = LEVELS.find((l) => l.key === sample);
    if (!level) return new Response('not found', { status: 404 });
    return render({
      name: 'Марк Петренко', levelKey: level.key, score: SAMPLE_SCORE[level.key], max: OLIMP.questionCount,
      date: 'дата олімпіади', no: 'зразок',
    }, { k: 0.5, headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } });
  }

  const t = searchParams.get('t');
  if (!validToken(t)) return new Response('not found', { status: 404 });
  const store = getStore();
  const entry = store ? await store.get(t) : null;
  if (!entry || !entry.finished_at) return new Response('not found', { status: 404 });

  const headers = { 'Cache-Control': 'private, max-age=3600' };
  if (searchParams.get('dl')) headers['Content-Disposition'] = 'attachment; filename="dyplom-olimpiada-dityam.png"';
  return render({
    name: String(entry.child_name || ''), levelKey: entry.level, score: entry.score, max: entry.max_score,
    date: diplomaDate(entry.finished_at), no: `№ ${diplomaNo(entry.token)}`,
  }, { headers });
}
