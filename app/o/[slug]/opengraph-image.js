import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { TYPE_LABELS, AID_TYPE_LABELS, COST_LABELS, ageLabel } from '@/lib/labels';

// nodejs (not edge) бо шрифт читаємо з диска. Картинка генерується на білді
// для кожного slug з generateStaticParams у page.js і кешується як статика.
export const runtime = 'nodejs';
export const revalidate = 3600;

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Можливість для дитини — dityam.com.ua';

// Satori не вміє woff2, тож у репо лежать саме ttf з кириличним сабсетом.
const fontDir = path.join(process.cwd(), 'public', 'fonts');
let fontCache = null;
async function fonts() {
  if (!fontCache) {
    const [medium, bold] = await Promise.all([
      readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
      readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
    ]);
    fontCache = [
      { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
      { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
    ];
  }
  return fontCache;
}

function formatDeadline(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  return `до ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

async function getItem(slug) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('opportunities')
    .select('title, summary, opportunity_type, aid_type, age_from, age_to, cost_type, deadline, cities')
    .eq('slug', slug)
    .maybeSingle();
  return data || null;
}

export default async function Image({ params }) {
  const item = await getItem(params.slug);

  // Slug зник між білдом і рендером — віддаємо загальну картку, не 500.
  const title = item?.title || 'Можливості для дитини';
  const typeLabel = item ? (TYPE_LABELS[item.opportunity_type] || 'Можливість') : 'можливості для дітей';
  const chips = [];
  // Без емодзі: у Manrope немає для них гліфів, а satori інакше тягнув би
  // SVG-емодзі з зовнішнього CDN на кожен рендер. Текст несе ту саму інформацію.
  if (item) {
    if (item.aid_type) chips.push(AID_TYPE_LABELS[item.aid_type] || 'держдопомога');
    if (Number.isFinite(item.age_from) && Number.isFinite(item.age_to)) {
      chips.push(ageLabel(item.age_from, item.age_to));
    }
    if (COST_LABELS[item.cost_type]) chips.push(COST_LABELS[item.cost_type]);
    const deadline = formatDeadline(item.deadline);
    if (deadline) chips.push(deadline);
    const city = (item.cities || [])[0];
    if (city) chips.push(city);
  }

  // Довгі заголовки ріжемо — Satori не робить ellipsis по рядках надійно.
  const shownTitle = title.length > 95 ? `${title.slice(0, 94).trimEnd()}…` : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 72px',
          backgroundColor: '#fefcf7',
          // Кінцевий стоп — колір фону з alpha 0, а не `transparent`: satori
          // інтерполює `transparent` через чорний і градієнт сіріє.
          backgroundImage:
            'radial-gradient(ellipse at top left, #fef2eb 0%, rgba(254,252,247,0) 55%),' +
            'radial-gradient(ellipse at top right, #e8f4f2 0%, rgba(254,252,247,0) 55%)',
          fontFamily: 'Manrope',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              fontWeight: 700,
              color: '#e85d24',
              letterSpacing: '-0.02em',
            }}
          >
            dityam.com.ua
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              fontWeight: 500,
              color: '#ffffff',
              backgroundColor: '#e85d24',
              borderRadius: 999,
              padding: '6px 18px',
            }}
          >
            {typeLabel}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            fontSize: shownTitle.length > 55 ? 56 : 68,
            fontWeight: 700,
            color: '#1a1a1a',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}
        >
          {shownTitle}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {chips.map((chip) => (
            <div
              key={chip}
              style={{
                display: 'flex',
                fontSize: 26,
                fontWeight: 500,
                color: '#555555',
                backgroundColor: '#ffffff',
                border: '1px solid #e8e3d6',
                borderRadius: 14,
                padding: '10px 20px',
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: await fonts() }
  );
}
