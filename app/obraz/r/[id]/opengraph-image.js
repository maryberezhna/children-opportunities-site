// Превʼю обкладинки для месенджерів і соцмереж: мама кидає посилання — і у
// Viber/Telegram видно саму обкладинку з іменем дитини, а не загальну картинку.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { OBRAZ, validPublicId, imageUrl, yearsWord } from '@/lib/obraz';
import { FABRICS, fabricFor, fabricDataUri, designerLabel } from '@/lib/obraz-cover';
import { obrazDb, workByPublicId } from '@/lib/obraz-server';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Обкладинка модного журналу dityam.com.ua';

const fontDir = path.join(process.cwd(), 'public', 'fonts');

export default async function Image({ params }) {
  const [caveat, lora, manrope] = await Promise.all([
    readFile(path.join(fontDir, 'Caveat-Bold.ttf')),
    readFile(path.join(fontDir, 'Lora-SemiBold.ttf')),
    readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
  ]);
  const db = validPublicId(params.id) ? obrazDb() : null;
  const w = db ? await workByPublicId(db, params.id).catch(() => null) : null;
  const key = w ? fabricFor(w.public_id, w.fabric) : 'tartan';
  const f = FABRICS[key];
  const label = w ? designerLabel(w) : '';
  const img = w ? imageUrl(w.image_path) : null;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: '#f6efe4', fontFamily: 'Manrope' }}>
        <div style={{ width: 472, height: 630, display: 'flex', position: 'relative' }}>
          <img src={fabricDataUri(key, 472, 630)} width={472} height={630} style={{ position: 'absolute', left: 0, top: 0 }} />
          <div style={{ position: 'absolute', left: 24, top: 24, right: 24, bottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: f.band }}>
            <div style={{ display: 'flex', fontFamily: 'Caveat', fontSize: 72, color: f.accent, marginTop: 6, lineHeight: 1 }}>dityam.com.ua</div>
            <div style={{ display: 'flex', fontSize: 14, letterSpacing: 3, color: '#666', textTransform: 'uppercase' }}>{`${OBRAZ.season} · Kids Fashion`}</div>
            <div style={{ display: 'flex', flex: 1, width: '100%', padding: '12px 18px', justifyContent: 'center', alignItems: 'center' }}>
              {img ? <img src={img} style={{ maxWidth: 380, maxHeight: 400, objectFit: 'contain' }} /> : null}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 64px' }}>
          <div style={{ display: 'flex', fontSize: 24, letterSpacing: 4, color: '#c8501a', textTransform: 'uppercase' }}>Обкладинка</div>
          <div style={{ display: 'flex', fontFamily: 'Lora', fontSize: 66, lineHeight: 1.08, color: '#1a1a1a', marginTop: 12 }}>{w ? `«${w.title}»` : OBRAZ.title}</div>
          {w ? <div style={{ display: 'flex', fontSize: 34, color: '#333', marginTop: 22 }}>{`${label ? `${label} ` : ''}${w.child_name}, ${w.age} ${yearsWord(w.age)}`}</div> : null}
          <div style={{ display: 'flex', fontSize: 26, color: '#6b6b6b', marginTop: 34 }}>{`Онлайн-челендж «${OBRAZ.title}» · dityam.com.ua`}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Caveat', data: caveat, weight: 700, style: 'normal' },
        { name: 'Lora', data: lora, weight: 600, style: 'normal' },
        { name: 'Manrope', data: manrope, weight: 700, style: 'normal' },
      ],
    },
  );
}
