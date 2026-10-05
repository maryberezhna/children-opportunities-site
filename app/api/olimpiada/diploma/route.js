// Диплом онлайн-олімпіади — картинка A4 (альбомна), яку можна зберегти,
// надіслати в Telegram і надрукувати. Малюється з запису в базі за токеном,
// тож «золотий рівень» не підробити зміною адреси.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OLIMP, levelByKey, diplomaNo, diplomaDate } from '@/lib/olimpiada';
import { getStore, validToken } from '@/lib/olimpiada-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const fontDir = path.join(process.cwd(), 'public', 'fonts');
const W = 1754;
const H = 1240;

const TONES = {
  gold: { main: '#b7791f', soft: '#fdf3d7', ring: '#e9b949' },
  silver: { main: '#5b6b7b', soft: '#eef2f6', ring: '#aab8c5' },
  bronze: { main: '#a05a2c', soft: '#fbe9dc', ring: '#d79a6b' },
  participant: { main: '#c8501a', soft: '#fdeee6', ring: '#f0a37f' },
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const t = searchParams.get('t');
  if (!validToken(t)) return new Response('not found', { status: 404 });
  const store = getStore();
  const entry = store ? await store.get(t) : null;
  if (!entry || !entry.finished_at) return new Response('not found', { status: 404 });

  const [medium, bold] = await Promise.all([
    readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
    readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
  ]);
  const level = levelByKey(entry.level);
  const tone = TONES[level.key] || TONES.participant;
  const name = String(entry.child_name || '');
  const nameSize = name.length > 34 ? 64 : name.length > 24 ? 80 : 96;

  const image = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: '#fffdf9', padding: 44, fontFamily: 'Manrope' }}>
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
          border: `6px solid ${tone.ring}`, borderRadius: 36, padding: '56px 80px 48px',
          backgroundImage: `radial-gradient(circle at 50% 0%, ${tone.soft} 0%, rgba(255,253,249,0) 60%)`,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: '0.24em', color: tone.main }}>
              ОНЛАЙН-ОЛІМПІАДА З ЛОГІКИ · DITYAM.COM.UA
            </div>
            <div style={{ display: 'flex', marginTop: 28, fontSize: 132, fontWeight: 700, color: '#1c1c1c', letterSpacing: '-0.02em', lineHeight: 1 }}>
              Диплом
            </div>
            <div style={{
              display: 'flex', marginTop: 28, fontSize: 40, fontWeight: 700, color: '#ffffff', backgroundColor: tone.main,
              borderRadius: 999, padding: '12px 40px',
            }}>
              {level.key === 'participant' ? 'учасника' : level.label}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 500, color: '#6b6b6b' }}>нагороджується</div>
            <div style={{ display: 'flex', marginTop: 10, fontSize: nameSize, fontWeight: 700, color: '#1c1c1c', textAlign: 'center', lineHeight: 1.1 }}>
              {name}
            </div>
            <div style={{ display: 'flex', marginTop: 26, fontSize: 34, fontWeight: 500, color: '#3d3d3d', textAlign: 'center' }}>
              {`за участь в онлайн-олімпіаді з логіки, вікова група ${OLIMP.groupLabel}`}
            </div>
            <div style={{ display: 'flex', marginTop: 12, fontSize: 40, fontWeight: 700, color: tone.main }}>
              {`Результат: ${entry.score} з ${entry.max_score} балів`}
            </div>
          </div>

          <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 26, fontWeight: 500, color: '#6b6b6b' }}>{diplomaDate(entry.finished_at)}</div>
              <div style={{ display: 'flex', marginTop: 4, fontSize: 24, fontWeight: 500, color: '#8a8a8a' }}>{`№ ${diplomaNo(entry.token)}`}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, color: '#1c1c1c' }}>Марія Шутяк</div>
              <div style={{ display: 'flex', marginTop: 4, fontSize: 24, fontWeight: 500, color: '#6b6b6b' }}>засновниця Dityam.com.ua</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
        { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
      ],
    },
  );
  const headers = new Headers(image.headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  if (searchParams.get('dl')) headers.set('Content-Disposition', 'attachment; filename="dyplom-olimpiada-dityam.png"');
  return new Response(image.body, { status: 200, headers });
}
