// Диплом онлайн-олімпіади — картинка A4 (альбомна), яку можна зберегти,
// надіслати в Telegram і надрукувати. Справжній диплом малюється з запису в
// базі за токеном, тож «золотий рівень» не підробити зміною адреси.
// ?sample=gold|silver|bronze|participant — зразок без даних для сторінки
// олімпіади: щоб диплом хотілося мати, його треба побачити.
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

const TONES = {
  gold: { main: '#a86a0c', deep: '#8a5606', soft: '#fff3cf', ring: '#f2b93b', shine: '#ffe08a' },
  silver: { main: '#55687a', deep: '#3f4f5f', soft: '#eef3f8', ring: '#a9b8c6', shine: '#dbe5ee' },
  bronze: { main: '#9a5426', deep: '#7c4119', soft: '#fdeadb', ring: '#d9925c', shine: '#f3c39f' },
  participant: { main: '#1d3f94', deep: '#16307a', soft: '#e9f0ff', ring: '#5b8cf0', shine: '#bcd0ff' },
};

// Бали у зразках — посередині кожного рівня.
const SAMPLE_SCORE = { gold: 23, silver: 19, bronze: 14, participant: 9 };

// Медаль: дві стрічки й коло із зіркою в кольорі рівня.
function Medal({ tone, size }) {
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 200 236">
      <path d="M62 8 h44 l-14 104 h-44z" fill="#2a5cc0" />
      <path d="M138 8 h-44 l14 104 h44z" fill="#1d3f94" />
      <circle cx="100" cy="150" r="80" fill={tone.ring} />
      <circle cx="100" cy="150" r="64" fill={tone.shine} />
      <circle cx="100" cy="150" r="64" fill="none" stroke={tone.main} strokeWidth="3" />
      <path d="M100 104 l13.5 30 l32.5 3 l-24.5 21.5 l7.5 32 l-29 -17 l-29 17 l7.5 -32 l-24.5 -21.5 l32.5 -3z" fill={tone.main} />
    </svg>
  );
}

// Той самий одноокий монстрик, що на сторінці олімпіади.
function Mascot({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <path d="M26 30 q-12 -14 -4 -24 q6 12 18 14z M94 30 q12 -14 4 -24 q-6 12 -18 14z" fill="#5b1f8f" />
      <ellipse cx="60" cy="64" rx="44" ry="46" fill="#ffc93c" />
      <circle cx="60" cy="52" r="18" fill="#ffffff" />
      <circle cx="62" cy="54" r="8" fill="#1c1c1c" />
      <circle cx="65" cy="51" r="2.5" fill="#ffffff" />
      <path d="M42 80 q18 16 36 0 q-18 6 -36 0z" fill="#5b1f8f" />
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

function diploma({ name, levelKey, score, max, date, no, k }) {
  const level = levelByKey(levelKey);
  const tone = TONES[level.key] || TONES.participant;
  const px = (n) => Math.round(n * k);
  const nameSize = name.length > 34 ? 62 : name.length > 24 ? 78 : 94;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: tone.ring, padding: px(22), fontFamily: 'Manrope' }}>
      <div style={{
        flex: 1, display: 'flex', backgroundColor: '#fffdf7', borderRadius: px(30), padding: px(18),
        backgroundImage: `radial-gradient(circle at 50% 18%, ${tone.soft} 0%, rgba(255,253,247,0) 55%)`,
      }}>
        <div style={{
          flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
          border: `${px(4)}px solid ${tone.ring}`, borderRadius: px(20), padding: `${px(34)}px ${px(70)}px ${px(40)}px`,
        }}>
          <div style={{ position: 'absolute', left: px(34), top: px(34), display: 'flex' }}><Star size={px(54)} color={tone.ring} /></div>
          <div style={{ position: 'absolute', right: px(34), top: px(34), display: 'flex' }}><Star size={px(54)} color={tone.ring} /></div>
          <div style={{ position: 'absolute', left: px(110), top: px(96), display: 'flex' }}><Star size={px(26)} color={tone.shine} /></div>
          <div style={{ position: 'absolute', right: px(110), top: px(96), display: 'flex' }}><Star size={px(26)} color={tone.shine} /></div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: px(27), fontWeight: 700, letterSpacing: '0.22em', color: tone.main }}>
              ОНЛАЙН-ОЛІМПІАДА З ЛОГІКИ · DITYAM.COM.UA
            </div>
            <div style={{ display: 'flex', marginTop: px(14) }}><Medal tone={tone} size={px(186)} /></div>
            <div style={{ display: 'flex', marginTop: px(0), fontSize: px(112), fontWeight: 700, color: '#16307a', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Диплом
            </div>
            <div style={{
              display: 'flex', marginTop: px(20), fontSize: px(38), fontWeight: 700, color: '#ffffff', backgroundColor: tone.main,
              borderRadius: 999, padding: `${px(10)}px ${px(40)}px`,
            }}>
              {level.key === 'participant' ? 'учасника олімпіади' : level.label}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: px(30), fontWeight: 500, color: '#6b6b6b' }}>нагороджується</div>
            <div style={{ display: 'flex', marginTop: px(6), fontSize: px(nameSize), fontWeight: 700, color: '#1c1c1c', textAlign: 'center', lineHeight: 1.1 }}>
              {name}
            </div>
            <div style={{ display: 'flex', marginTop: px(20), fontSize: px(32), fontWeight: 500, color: '#3d3d3d', textAlign: 'center' }}>
              {`за участь в онлайн-олімпіаді з логіки, вікова група ${OLIMP.groupLabel}`}
            </div>
            <div style={{ display: 'flex', marginTop: px(10), fontSize: px(40), fontWeight: 700, color: tone.main }}>
              {`Результат: ${score} з ${max} балів`}
            </div>
          </div>

          <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: px(420) }}>
              <div style={{ display: 'flex', fontSize: px(26), fontWeight: 500, color: '#6b6b6b' }}>{date}</div>
              <div style={{ display: 'flex', marginTop: px(4), fontSize: px(24), fontWeight: 500, color: '#8a8a8a' }}>{no}</div>
            </div>
            <div style={{ display: 'flex' }}><Mascot size={px(120)} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: px(420) }}>
              <div style={{ display: 'flex', fontSize: px(28), fontWeight: 700, color: '#1c1c1c' }}>Марія Шутяк</div>
              <div style={{ display: 'flex', marginTop: px(4), fontSize: px(24), fontWeight: 500, color: '#6b6b6b' }}>засновниця Dityam.com.ua</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function render(data, { k = 1, headers = {} } = {}) {
  const [medium, bold] = await Promise.all([
    readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
    readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
  ]);
  const image = new ImageResponse(diploma({ ...data, k }), {
    width: Math.round(W * k),
    height: Math.round(H * k),
    fonts: [
      { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
      { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
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
      name: 'Імʼя вашої дитини', levelKey: level.key, score: SAMPLE_SCORE[level.key], max: OLIMP.questionCount,
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
