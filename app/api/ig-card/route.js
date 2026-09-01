import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { TYPE_LABELS, AID_TYPE_LABELS, COST_LABELS, ageLabel } from '@/lib/labels';

/**
 * Картинка під Instagram: 1080×1350 (4:5 — найбільше місця в стрічці).
 *
 * Той самий візуальний словник, що й в OG-обкладинках: людина має впізнати
 * Dityam у стрічці, не читаючи підпису. Різниця лише в пропорції й у тому,
 * що тут є місце на заклик — у стрічці ніхто не бачить адреси сайту, тож
 * вона мусить бути на самій картинці.
 */
export const runtime = 'nodejs';
export const revalidate = 3600;

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

function deadlineLabel(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  return `до ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get('slug') || '';
  let item = null;
  if (supabase && slug) {
    const { data } = await supabase
      .from('opportunities')
      .select('title, opportunity_type, aid_type, age_from, age_to, cost_type, deadline, cities')
      .eq('slug', slug)
      .maybeSingle();
    item = data || null;
  }

  const title = item?.title || 'Можливості для дитини';
  const typeLabel = item ? (TYPE_LABELS[item.opportunity_type] || 'Можливість') : 'Можливості';
  const chips = [];
  if (item) {
    if (item.aid_type) chips.push(AID_TYPE_LABELS[item.aid_type] || 'держдопомога');
    if (Number.isFinite(item.age_from) && Number.isFinite(item.age_to)) {
      chips.push(ageLabel(item.age_from, item.age_to));
    }
    if (COST_LABELS[item.cost_type]) chips.push(COST_LABELS[item.cost_type]);
    const city = (item.cities || []).find((c) => c && c !== 'Вся Україна');
    if (city) chips.push(city);
  }
  const deadline = deadlineLabel(item?.deadline);
  const shown = title.length > 88 ? `${title.slice(0, 87).trimEnd()}…` : title;

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '84px 72px',
        backgroundColor: '#fefcf7',
        backgroundImage:
          'radial-gradient(ellipse at top left, #fef2eb 0%, rgba(254,252,247,0) 55%),'
          + 'radial-gradient(ellipse at bottom right, #e8f4f2 0%, rgba(254,252,247,0) 55%)',
        fontFamily: 'Manrope',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
          <div style={{
            display: 'flex', alignSelf: 'flex-start', fontSize: 30, fontWeight: 500,
            color: '#ffffff', backgroundColor: '#e85d24', borderRadius: 999, padding: '10px 26px',
          }}>{typeLabel}</div>
          {deadline ? (
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: '#b8471a' }}>
              {deadline}
            </div>
          ) : null}
        </div>

        <div style={{
          display: 'flex', fontSize: shown.length > 52 ? 66 : 82, fontWeight: 700,
          color: '#1a1a1a', lineHeight: 1.12, letterSpacing: '-0.02em',
        }}>{shown}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 34 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {chips.map((chip) => (
              <div key={chip} style={{
                display: 'flex', fontSize: 28, fontWeight: 500, color: '#54617a',
                backgroundColor: '#ffffff', border: '2px solid #e8e3d6',
                borderRadius: 999, padding: '10px 22px',
              }}>{chip}</div>
            ))}
          </div>
          {/* Адреса на самій картинці: у стрічці посилання не клікають, його
              запамʼятовують — або не запамʼятовують, якщо його там немає. */}
          <div style={{
            display: 'flex', fontSize: 34, fontWeight: 700, color: '#e85d24',
            letterSpacing: '-0.02em',
          }}>dityam.com.ua</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: await fonts() },
  );
}
