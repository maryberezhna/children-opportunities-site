// Диплом онлайн-олімпіади — картинка A4 (альбомна), яку можна зберегти,
// надіслати в Telegram і надрукувати. Справжній диплом малюється з запису в
// базі за токеном, тож «золотий рівень» не підробити зміною адреси.
// ?sample=gold|silver|bronze|participant — зразок без даних для сторінки
// олімпіади: щоб диплом хотілося мати, його треба побачити.
//
// Стиль — як у сторінки олімпіади (Марія, 06.10.2026: «диплом дуже нудний,
// зроби у такому стилі, як сайт»): синє зоряне небо, монстрики, рукописний
// заголовок Caveat, біла картка з медаллю.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OLIMP, LEVELS, levelByKey, diplomaNo, diplomaDate } from '@/lib/olimpiada';
import { getStore, validToken } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fontDir = path.join(process.cwd(), 'public', 'fonts');
const W = 1754;
const H = 1240;
const BLUE = '#2a5cc0';
const NAVY = '#16307a';

const TONES = {
  gold: { main: '#b7791f', deep: '#8a5606', ring: '#f2b93b', shine: '#ffe08a', pill: '#ffc93c', pillInk: NAVY },
  silver: { main: '#55687a', deep: '#3f4f5f', ring: '#aab8c6', shine: '#e3eaf1', pill: '#d7dfe8', pillInk: NAVY },
  bronze: { main: '#9a5426', deep: '#7c4119', ring: '#d9925c', shine: '#f3c39f', pill: '#f0b07a', pillInk: NAVY },
  participant: { main: '#2f66d0', deep: '#1d3f94', ring: '#5b8cf0', shine: '#bcd0ff', pill: '#5b8cf0', pillInk: '#ffffff' },
};

// Бали у зразках — посередині кожного рівня.
const SAMPLE_SCORE = { gold: 23, silver: 19, bronze: 14, participant: 9 };

// Зірки на небі: сталі координати, щоб диплом щоразу був однаковий.
const STARS = [
  [60, 90, 5], [210, 50, 3], [330, 150, 4], [520, 40, 3], [700, 110, 5], [900, 60, 3], [1100, 130, 4], [1300, 50, 3], [1500, 100, 5], [1680, 160, 3],
  [40, 420, 3], [1710, 520, 4], [30, 760, 4], [1715, 860, 3], [90, 1130, 4], [300, 1190, 3], [560, 1150, 5], [820, 1200, 3], [1050, 1160, 4], [1330, 1195, 3], [1560, 1140, 5], [1690, 1210, 3],
];

function Sky({ k }) {
  const px = (v) => Math.round(v * k);
  return (
    <svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      {STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#ffffff" opacity={r === 3 ? 0.55 : 0.95} />)}
      <circle cx={1610} cy={330} r={5} fill="#7e57ff" />
      <circle cx={140} cy={980} r={5} fill="#7e57ff" />
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

// Конфеті навколо картки: сталі координати, кольори сайту.
const CONFETTI = [
  [120, 160, 0, '#ffc93c'], [210, 520, 30, '#ff5fa2'], [70, 640, -20, '#7be0a3'], [160, 1030, 15, '#ffc93c'], [330, 1150, -35, '#ff7a45'],
  [1560, 180, 25, '#ff5fa2'], [1690, 420, -15, '#ffc93c'], [1600, 700, 40, '#7be0a3'], [1690, 1000, -30, '#ff7a45'], [1450, 1170, 20, '#ffc93c'],
  [600, 50, 35, '#7be0a3'], [980, 30, -25, '#ff5fa2'], [1250, 70, 15, '#ffc93c'], [760, 1190, -40, '#ff7a45'], [1120, 1200, 30, '#7be0a3'],
];

function diploma({ name, levelKey, score, max, date, no, k }) {
  const level = levelByKey(levelKey);
  const tone = TONES[level.key] || TONES.participant;
  const px = (n) => Math.round(n * k);
  const nameSize = name.length > 34 ? 60 : name.length > 24 ? 76 : 96;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: BLUE, padding: px(54), fontFamily: 'Manrope' }}>
      <Sky k={k} />
      {CONFETTI.map(([x, y, rot, color], i) => (
        <div key={i} style={{ position: 'absolute', left: px(x), top: px(y), width: px(i % 3 === 0 ? 26 : 16), height: px(i % 3 === 0 ? 12 : 16), borderRadius: i % 2 ? 999 : px(3), backgroundColor: color, transform: `rotate(${rot}deg)`, display: 'flex' }} />
      ))}
      <div style={{ position: 'absolute', left: px(58), top: px(300), display: 'flex' }}><Rocket size={px(130)} /></div>
      <div style={{ position: 'absolute', right: px(52), bottom: px(300), display: 'flex' }}><Planet size={px(140)} /></div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', position: 'relative',
        margin: `${px(10)}px ${px(150)}px`, backgroundColor: '#ffffff', borderRadius: px(48), padding: `${px(44)}px ${px(70)}px ${px(36)}px`,
        border: `${px(10)}px solid ${tone.ring}`,
      }}>
        <div style={{ position: 'absolute', left: px(28), top: px(30), display: 'flex' }}><Star size={px(40)} color={tone.shine} /></div>
        <div style={{ position: 'absolute', right: px(28), top: px(30), display: 'flex' }}><Star size={px(40)} color={tone.shine} /></div>
        <div style={{ position: 'absolute', left: px(60), bottom: px(150), display: 'flex' }}><Star size={px(26)} color={tone.shine} /></div>
        <div style={{ position: 'absolute', right: px(60), bottom: px(150), display: 'flex' }}><Star size={px(26)} color={tone.shine} /></div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', fontSize: px(24), fontWeight: 700, letterSpacing: '0.2em', color: '#5a72b5' }}>ОНЛАЙН-ОЛІМПІАДА З ЛОГІКИ ·</div>
            <div style={{ display: 'flex', marginLeft: px(14), fontFamily: 'Caveat', fontSize: px(44), fontWeight: 700, color: '#e85d24', lineHeight: 1 }}>dityam.com.ua</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: px(4) }}>
            <div style={{ display: 'flex' }}><Medal tone={tone} size={px(200)} /></div>
            <div style={{ display: 'flex', position: 'relative', marginLeft: px(30) }}>
              <div style={{ position: 'absolute', left: px(-10), top: px(96), width: px(520), height: px(54), backgroundColor: tone.pill, borderRadius: px(14), transform: 'rotate(-2deg)', display: 'flex', opacity: 0.9 }} />
              <div style={{ display: 'flex', fontFamily: 'Caveat', fontSize: px(200), fontWeight: 700, color: '#1d3f94', lineHeight: 1, position: 'relative' }}>Диплом</div>
            </div>
          </div>
          <div style={{
            display: 'flex', marginTop: px(6), fontSize: px(38), fontWeight: 700, color: tone.pillInk, backgroundColor: tone.pill,
            borderRadius: 999, padding: `${px(10)}px ${px(44)}px`, transform: 'rotate(-2deg)',
          }}>
            {level.key === 'participant' ? 'учасника олімпіади' : level.label}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: px(30), fontWeight: 500, color: '#5a72b5' }}>нагороджується</div>
          <div style={{ display: 'flex', position: 'relative', marginTop: px(4) }}>
            <div style={{ position: 'absolute', left: px(-16), right: px(-16), bottom: px(6), height: px(26), backgroundColor: '#dbe8ff', borderRadius: px(10), transform: 'rotate(-1deg)', display: 'flex' }} />
            <div style={{ display: 'flex', position: 'relative', fontSize: px(nameSize), fontWeight: 700, color: NAVY, textAlign: 'center', lineHeight: 1.1 }}>{name}</div>
          </div>
          <div style={{ display: 'flex', marginTop: px(16), fontSize: px(30), fontWeight: 500, color: '#2c4a9a', textAlign: 'center' }}>
            {`за участь в онлайн-олімпіаді з логіки для дітей ${OLIMP.groupLabel}`}
          </div>
          <div style={{ display: 'flex', marginTop: px(8), fontFamily: 'Caveat', fontSize: px(64), fontWeight: 700, color: '#f5a023' }}>
            {`Результат: ${score} з ${max} балів`}
          </div>
        </div>

        <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: px(420) }}>
            <div style={{ display: 'flex', fontSize: px(24), fontWeight: 500, color: '#5a72b5' }}>{date}</div>
            <div style={{ display: 'flex', marginTop: px(4), fontSize: px(22), fontWeight: 500, color: '#8a98c4' }}>{no}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: px(420) }}>
            <div style={{ display: 'flex', fontFamily: 'Caveat', fontSize: px(40), fontWeight: 700, color: NAVY }}>Марія Шутяк</div>
            <div style={{ display: 'flex', alignItems: 'baseline', marginTop: px(2) }}>
              <div style={{ display: 'flex', fontSize: px(22), fontWeight: 500, color: '#5a72b5' }}>засновниця</div>
              <div style={{ display: 'flex', marginLeft: px(8), fontFamily: 'Caveat', fontSize: px(34), fontWeight: 700, color: '#e85d24', lineHeight: 1 }}>dityam.com.ua</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: 'absolute', left: px(70), bottom: px(40), display: 'flex' }}><MonsterPink size={px(200)} /></div>
      <div style={{ position: 'absolute', right: px(80), top: px(34), display: 'flex' }}><MonsterYellow size={px(170)} /></div>
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
