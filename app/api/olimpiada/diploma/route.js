// Диплом онлайн-олімпіади — картинка A4 (портрет), яку можна зберегти,
// надіслати в Telegram і надрукувати. Справжній диплом малюється з запису в
// базі за токеном, тож «золотий рівень» не підробити зміною адреси.
// ?sample=gold|silver|bronze|participant — зразок без даних для сторінки
// олімпіади: щоб диплом хотілося мати, його треба побачити.
//
// Стиль v6 (Марія, 06.10.2026: попередній із монстриками — «занадто дитячий
// для 10 років»; «фон у них має відрізнятися також»): «паперовий» диплом —
// світлий фон у кольорі рівня, по краях тонка геометрія логічних фігур,
// біла картка, медаль зі стрічкою, великий «ДИПЛОМ», імʼя рукописним Caveat.
// Бренд — лише dityam.com.ua в стилі логотипа.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OLIMP, LEVELS, levelByKey, diplomaNo, diplomaDate } from '@/lib/olimpiada';
import { getStore, validToken } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const fontDir = path.join(process.cwd(), 'public', 'fonts');
const W = 1240;
const H = 1754;
const INK = '#141a3a';
const BRAND = '#e85d24';

// Палітра рівня: фон сторінки, лінії й заливки фігур на рамці, медаль, плашка.
const TONES = {
  gold: { bg: '#fff3d1', line: '#c9931f', fill: '#f2b93b', accent: '#9a6b0f', main: '#b7791f', deep: '#8a5606', ring: '#f2b93b', shine: '#ffe08a', label: '#f2b93b', labelInk: '#3a2a05' },
  silver: { bg: '#eef2f7', line: '#7d8ea0', fill: '#aab8c6', accent: '#4a5b6c', main: '#55687a', deep: '#3f4f5f', ring: '#aab8c6', shine: '#e3eaf1', label: '#c3ced9', labelInk: '#1f2a36' },
  bronze: { bg: '#fbe8da', line: '#b86d33', fill: '#d9925c', accent: '#8a4a1f', main: '#9a5426', deep: '#7c4119', ring: '#d9925c', shine: '#f3c39f', label: '#d9925c', labelInk: '#3a1d08' },
  participant: { bg: '#e9f0ff', line: '#4a76d8', fill: '#5b8cf0', accent: '#1d3f94', main: '#2f66d0', deep: '#1d3f94', ring: '#5b8cf0', shine: '#bcd0ff', label: '#5b8cf0', labelInk: '#ffffff' },
};

// Бали у зразках — посередині кожного рівня.
const SAMPLE_SCORE = { gold: 23, silver: 19, bronze: 14, participant: 9 };

// Фігури з логічних завдань по краях аркуша: трикутник, квадрат, коло,
// шестикутник, плюс, ромб — тонкими лініями, кожна третя залита. Координати
// сталі, тож диплом щоразу однаковий.
const KINDS = ['tri', 'sq', 'circle', 'hex', 'plus', 'diamond'];
const EDGE = 56;
const STEP = 112;
const SPOTS = [];
for (let x = 60; x <= W - 60; x += STEP) { SPOTS.push([x, EDGE]); SPOTS.push([x, H - EDGE]); }
for (let y = 168; y <= H - 168; y += STEP) { SPOTS.push([EDGE, y]); SPOTS.push([W - EDGE, y]); }

function figure(x, y, kind, s, tone, filled, key) {
  const common = { fill: filled ? tone.fill : 'none', stroke: tone.line, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round', opacity: filled ? 0.85 : 0.75 };
  switch (kind) {
    case 'tri': return <path key={key} d={`M${x} ${y - s} L${x + s} ${y + s * 0.8} L${x - s} ${y + s * 0.8} Z`} {...common} />;
    case 'sq': return <rect key={key} x={x - s} y={y - s} width={s * 2} height={s * 2} rx={4} {...common} />;
    case 'circle': return <circle key={key} cx={x} cy={y} r={s} {...common} />;
    case 'hex': return <path key={key} d={`M${x} ${y - s} L${x + s * 0.87} ${y - s / 2} L${x + s * 0.87} ${y + s / 2} L${x} ${y + s} L${x - s * 0.87} ${y + s / 2} L${x - s * 0.87} ${y - s / 2} Z`} {...common} />;
    case 'plus': return <path key={key} d={`M${x - s} ${y} H${x + s} M${x} ${y - s} V${x + s > 0 ? y + s : y}`} {...common} fill="none" />;
    default: return <path key={key} d={`M${x} ${y - s} L${x + s} ${y} L${x} ${y + s} L${x - s} ${y} Z`} {...common} />;
  }
}

function Frame({ k, tone }) {
  const px = (v) => Math.round(v * k);
  return (
    <svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <rect x="0" y="0" width={W} height={H} fill={tone.bg} />
      {SPOTS.map(([x, y], i) => figure(x, y, KINDS[i % KINDS.length], 19, tone, i % 3 === 0, i))}
    </svg>
  );
}

// Великі напівпрозорі фігури за текстом — коло, трикутник і квадрат, як у
// завданнях на закономірності.
function Watermark({ k, tone }) {
  const px = (v) => Math.round(v * k);
  return (
    <svg width={px(W)} height={px(H)} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <circle cx="400" cy="1010" r="230" fill="none" stroke={tone.line} strokeWidth="14" opacity="0.07" />
      <path d="M620 700 L900 1190 H340 Z" fill="none" stroke={tone.line} strokeWidth="14" strokeLinejoin="round" opacity="0.07" />
      <rect x="640" y="820" width="330" height="330" rx="36" fill="none" stroke={tone.line} strokeWidth="14" opacity="0.07" transform="rotate(12 805 985)" />
    </svg>
  );
}

// Медаль: дві стрічки й коло із зіркою в кольорі рівня.
function Medal({ tone, size }) {
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 200 236">
      <path d="M62 8 h44 l-14 104 h-44z" fill={tone.main} />
      <path d="M138 8 h-44 l14 104 h44z" fill={tone.deep} />
      <circle cx="100" cy="150" r="80" fill={tone.ring} />
      <circle cx="100" cy="150" r="64" fill={tone.shine} />
      <circle cx="100" cy="150" r="64" fill="none" stroke={tone.main} strokeWidth="3" />
      <path d="M100 104 l13.5 30 l32.5 3 l-24.5 21.5 l7.5 32 l-29 -17 l-29 17 l7.5 -32 l-24.5 -21.5 l32.5 -3z" fill={tone.main} />
    </svg>
  );
}

// Роздільник: лінія, три маленькі фігури, лінія — одним SVG; лінії контурними
// path: порожні div, <line> і тонкі <rect> satori малює крапками.
function Divider({ k, tone }) {
  const px = (v) => Math.round(v * k);
  return (
    <svg width={px(760)} height={px(34)} viewBox="0 0 760 34">
      <path d="M0 17 H300" stroke={tone.fill} strokeWidth="2.5" />
      <path d="M335 4 L357 30 H313 Z" fill="none" stroke={tone.line} strokeWidth="3" strokeLinejoin="round" />
      <rect x="368" y="5" width="24" height="24" rx="4" fill={tone.fill} />
      <circle cx="426" cy="17" r="13" fill="none" stroke={tone.line} strokeWidth="3" />
      <path d="M460 17 H760" stroke={tone.fill} strokeWidth="2.5" />
    </svg>
  );
}

function diploma({ name, levelKey, score, max, date, no, k }) {
  const level = levelByKey(levelKey);
  const tone = TONES[level.key] || TONES.participant;
  const px = (n) => Math.round(n * k);
  const nameSize = name.length > 30 ? 76 : name.length > 22 ? 96 : 118;
  const label = level.key === 'participant' ? 'Учасник олімпіади' : level.label;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: tone.bg, fontFamily: 'Manrope' }}>
      <Frame k={k} tone={tone} />
      <div style={{ position: 'absolute', left: px(110), top: px(110), width: px(W - 220), height: px(H - 220), display: 'flex', backgroundColor: '#ffffff', borderRadius: px(28), border: `${Math.max(1, px(3))}px solid ${tone.fill}` }} />
      <Watermark k={k} tone={tone} />

      <div style={{ position: 'absolute', left: px(170), top: px(190), width: px(900), height: px(1360), display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <div style={{ display: 'flex', fontSize: px(22), fontWeight: 700, letterSpacing: '0.22em', color: tone.accent }}>ОНЛАЙН-ОЛІМПІАДА З ЛОГІКИ ·</div>
            <div style={{ display: 'flex', marginLeft: px(12), fontFamily: 'Caveat', fontSize: px(42), fontWeight: 700, color: BRAND, lineHeight: 1 }}>dityam.com.ua</div>
          </div>
          <div style={{ display: 'flex', marginTop: px(22), fontSize: px(172), fontWeight: 700, letterSpacing: '0.06em', color: INK, lineHeight: 1 }}>ДИПЛОМ</div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: px(26) }}>
            <div style={{ display: 'flex' }}><Medal tone={tone} size={px(118)} /></div>
            <div style={{ display: 'flex', marginLeft: px(22), fontSize: px(30), fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: tone.labelInk, backgroundColor: tone.label, borderRadius: px(10), padding: `${px(14)}px ${px(34)}px` }}>
              {label}
            </div>
          </div>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'center', marginTop: px(40) }}><Divider k={k} tone={tone} /></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: px(26), fontWeight: 700, letterSpacing: '0.18em', color: tone.accent }}>НАГОРОДЖУЄТЬСЯ</div>
          <div style={{ display: 'flex', marginTop: px(12), fontFamily: 'Caveat', fontSize: px(nameSize), fontWeight: 700, color: INK, lineHeight: 1.05 }}>{name}</div>
          <div style={{ display: 'flex', marginTop: px(24), fontSize: px(28), fontWeight: 500, color: '#3d4668', lineHeight: 1.4 }}>
            {`за участь в онлайн-олімпіаді з логіки для дітей ${OLIMP.groupLabel}`}
          </div>
          <div style={{ display: 'flex', marginTop: px(26), fontSize: px(46), fontWeight: 700, color: tone.accent }}>
            {`Результат: ${score} з ${max} балів`}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'center', marginBottom: px(36) }}><Divider k={k} tone={tone} /></div>
          <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', justifyContent: 'space-between', padding: `0 ${px(30)}px` }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', fontSize: px(20), fontWeight: 700, letterSpacing: '0.18em', color: tone.accent }}>ДАТА</div>
              <div style={{ display: 'flex', marginTop: px(6), fontSize: px(24), fontWeight: 700, color: INK }}>{date}</div>
              <div style={{ display: 'flex', marginTop: px(4), fontSize: px(20), fontWeight: 500, color: '#7a829f' }}>{no}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', fontSize: px(20), fontWeight: 700, letterSpacing: '0.18em', color: tone.accent }}>ПІДПИС</div>
              <div style={{ display: 'flex', marginTop: px(2), fontFamily: 'Caveat', fontSize: px(44), fontWeight: 700, color: INK }}>Марія Шутяк</div>
              <div style={{ display: 'flex', fontSize: px(20), fontWeight: 500, color: '#7a829f' }}>засновниця Dityam.com.ua</div>
            </div>
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
