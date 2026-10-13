// Превʼю «Модного коду» для соцмереж і месенджерів (13.10.2026: сторінка
// ділилась без картинки — «чи оптимізовані ці олімпіади під пошук і
// агентів»). Сливове тло сторінки, назва, і праворуч приклад обкладинки з
// луком — така сама фігура, як у студії (lookSvg).
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MK } from '@/lib/modnyi-kod';
import { DEFS, lookSvg } from '@/lib/modnyi-kod-looks';

export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `«${MK.title}» — онлайн-олімпіада з моди для дітей ${MK.ageFrom}–${MK.ageTo} років — Dityam.com.ua`;

const fontDir = path.join(process.cwd(), 'public', 'fonts');
// Приклад образу — той самий, що на першій обкладинці-прикладі сторінки.
const LOOK = { base: 'set', top: 'oversize', bottom: 'pleat', outer: 'none', shoes: 'loafer', acc: 'beret', f: { top: 'quilt', bottom: 'tartan', shoes: '#161616', acc: '#b0003a', legs: '#161616', base: 'polka', outer: 'hound', cover: 'tartan' } };

export default async function Image() {
  const [bold, medium, caveat] = await Promise.all(['Manrope-Bold.ttf', 'Manrope-Medium.ttf', 'Caveat-Bold.ttf'].map((f) => readFile(path.join(fontDir, f))));
  const fig = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 -6 160 438"><defs>${DEFS}</defs>${lookSvg(LOOK)}</svg>`;
  const pill = (t) => <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, color: '#3d1650', backgroundColor: '#f5c518', borderRadius: 999, padding: '8px 22px' }}>{t}</div>;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: '#3d1650', fontFamily: 'Manrope', padding: '52px 64px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 640 }}>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: '0.14em', color: '#ff6b9d' }}>DITYAM.COM.UA · ОНЛАЙН</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 112, fontWeight: 700, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.035em' }}>МОДНИЙ</div>
            <div style={{ display: 'flex', fontSize: 112, fontWeight: 700, color: '#f5c518', lineHeight: 1.05, letterSpacing: '-0.035em' }}>КОД</div>
            <div style={{ display: 'flex', marginTop: 18, fontSize: 34, fontWeight: 500, color: '#f3e8f8' }}>{`олімпіада з моди для дітей ${MK.ageFrom}–${MK.ageTo} років`}</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>{pill(`тест ${MK.minutes} хв`)}{pill('студія образу')}{pill('обкладинка')}</div>
        </div>
        <div style={{ display: 'flex', position: 'relative', width: 390, height: 526, backgroundColor: '#f3d6da', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center', fontFamily: 'Caveat', fontSize: 70, color: '#161616' }}>dityam.com.ua</div>
          <img src={`data:image/svg+xml;base64,${Buffer.from(fig).toString('base64')}`} width={165} height={452} style={{ position: 'absolute', left: 48, bottom: 26 }} />
          <div style={{ position: 'absolute', right: 24, top: 230, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 16, fontWeight: 700, letterSpacing: '0.18em', color: '#b0003a' }}>МОДНИЙ КОД</div>
            <div style={{ display: 'flex', fontSize: 50, fontWeight: 700, color: '#b0003a' }}>21/25</div>
          </div>
          <div style={{ position: 'absolute', right: 20, bottom: 20, display: 'flex', fontSize: 20, fontWeight: 700, color: '#ffffff', backgroundColor: '#161616', borderRadius: 999, padding: '4px 14px' }}>Приклад</div>
        </div>
      </div>
    ),
    { ...size, fonts: [
      { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
      { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
      { name: 'Caveat', data: caveat, weight: 700, style: 'normal' },
    ] },
  );
}
