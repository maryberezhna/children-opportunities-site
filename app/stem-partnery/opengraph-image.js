// Власне прев'ю «STEM-таланту України» для соцмереж і месенджерів — щоб
// репост виглядав як анонс конкурсу, а не обкладинка головної.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'STEM-талант України — онлайн-конкурс STEM-проєктів для школярів 12–17 років, 1 грудня 2026 – 10 січня 2027';

const fontDir = path.join(process.cwd(), 'public', 'fonts');

export default async function Image() {
  const [medium, bold] = await Promise.all([
    readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
    readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
  ]);
  const chip = (t, bg) => (
    <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, color: '#ffffff', backgroundColor: bg, borderRadius: 999, padding: '8px 20px' }}>{t}</div>
  );
  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '60px 72px', backgroundColor: '#0e1330', fontFamily: 'Manrope',
        backgroundImage: 'radial-gradient(circle at 12% 8%, rgba(59,91,255,.55) 0%, rgba(14,19,48,0) 45%), radial-gradient(circle at 92% 30%, rgba(124,92,255,.5) 0%, rgba(14,19,48,0) 45%), radial-gradient(circle at 55% 110%, rgba(20,184,143,.45) 0%, rgba(14,19,48,0) 40%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 500, color: '#c9d0f5' }}>STEM-партнери · онлайн-конкурс для школярів 12–17 років</div>
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 500, color: '#c9d0f5' }}>dityam.com.ua/stem-partnery</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 112, fontWeight: 700, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.035em' }}>STEM-талант</div>
          <div style={{ display: 'flex', fontSize: 112, fontWeight: 700, color: '#ffd447', lineHeight: 1.05, letterSpacing: '-0.035em' }}>України</div>
          <div style={{ display: 'flex', marginTop: 22, fontSize: 32, fontWeight: 500, color: '#e6eaff' }}>
            1 грудня 2026 – 10 січня 2027 · журі з інженерів і науковців
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14 }}>
          {chip('Програмування й ШІ', '#3b5bff')}
          {chip('Робототехніка й інженерія', '#14b88f')}
          {chip('Наука й математика', '#ff6a45')}
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
