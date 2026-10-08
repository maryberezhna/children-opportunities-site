// Прев'ю онлайн-олімпіади для соцмереж і месенджерів: щоб репост виглядав
// як запрошення на олімпіаду, а не як обкладинка головної.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OLIMP } from '@/lib/olimpiada';

export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `Онлайн-олімпіада з логіки для дітей ${OLIMP.groupLabel} — Dityam.com.ua`;

const fontDir = path.join(process.cwd(), 'public', 'fonts');

export default async function Image() {
  const [medium, bold] = await Promise.all([
    readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
    readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
  ]);
  const pill = (t, bg) => (
    <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, color: '#16307a', backgroundColor: bg, borderRadius: 999, padding: '10px 26px' }}>{t}</div>
  );
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '56px 72px', backgroundColor: '#2a5cc0', fontFamily: 'Manrope',
        backgroundImage: 'radial-gradient(circle at 88% 12%, rgba(255,201,60,.35) 0%, rgba(42,92,192,0) 38%), radial-gradient(circle at 8% 96%, rgba(126,87,255,.6) 0%, rgba(42,92,192,0) 42%)',
      }}>
        <div style={{ display: 'flex', fontSize: 28, fontWeight: 700, letterSpacing: '0.14em', color: '#ffc93c' }}>
          DITYAM.COM.UA · ОНЛАЙН
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 124, fontWeight: 700, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.035em' }}>ОЛІМПІАДА</div>
          <div style={{ display: 'flex', fontSize: 124, fontWeight: 700, color: '#ffc93c', lineHeight: 1.05, letterSpacing: '-0.035em' }}>З ЛОГІКИ</div>
          <div style={{ display: 'flex', marginTop: 18, fontSize: 36, fontWeight: 500, color: '#e6edff' }}>
            {`для дітей ${OLIMP.groupLabel} · диплом одразу після тесту`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {pill(`${OLIMP.questionCount} завдань`, '#ffffff')}
          {pill(`${OLIMP.minutes} хвилин`, '#ffc93c')}
          {pill('безкоштовно', '#f5a023')}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
        { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
      ],
    },
  );
}
