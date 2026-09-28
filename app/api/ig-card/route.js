import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { supabase } from '@/lib/supabase';
import { TYPE_LABELS, AID_TYPE_LABELS, COST_LABELS, ageLabel } from '@/lib/labels';
import { cutTitle } from '@/lib/text';

/**
 * Картинка під Instagram: 1080×1350 (4:5 — найбільше місця в стрічці).
 *
 * За бренд-кітом (public/press/dityam-brand-kit.zip, guidelines.html):
 * фон для постів і каруселей — «кремовий у клітинку» #F1EBDE; логотип —
 * справжній lockup зі знаком, а не набраний текст; кольори лише з палітри
 * (кремовий · чорнильний · помаранчевий ≤15% · teal як другий голос);
 * заголовок — вага 500 з трекінгом −0.025em (Manrope — кириличний напарник
 * DM Sans); рубрика — uppercase 500 +0.04em. До 28.09.2026 картка жила
 * своїм життям: світлий фон із градієнтами, сірі й коричневі кольори поза
 * палітрою, жирний заголовок і адреса замість логотипа.
 *
 * Адреса сайту на картинці лишається — вона і є логотипом: у стрічці
 * посилання не клікають, його запамʼятовують.
 */
export const runtime = 'nodejs';
export const revalidate = 3600;

const fontDir = path.join(process.cwd(), 'public', 'fonts');
const brandDir = path.join(process.cwd(), 'public', 'brand');
let fontCache = null;
let logoCache;
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

// Lockup з бренд-кіту (1858×414). Не прочитався — картка все одно
// має вийти: тоді адреса текстом, як було раніше.
async function logo() {
  if (logoCache === undefined) {
    try {
      const png = await readFile(path.join(brandDir, 'lockup-horizontal-orange.png'));
      logoCache = `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      logoCache = null;
    }
  }
  return logoCache;
}

// Палітра бренд-кіту (colors/brand-colors.txt).
const CREAM = '#f1ebde';
const INK = '#1a1a1a';
const INK_SOFT = '#4a4a4a';
const BORDER = '#e8e3d6';
const TEAL = '#cce8e0';
const TEAL_INK = '#0e5449';
// Помаранчевий текст на кремовому — темніший відтінок заради контрасту
// (WCAG AA, як --v2-accent-strong на сайті); #e85d24 — лише в логотипі.
const ORANGE_TEXT = '#c8501a';

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
  // До 28.09.2026 тут різали все довше за 88 символів посеред слова:
  // «…подорожей Європою в межах Discove…» (скриншот Марії). Місця на картці
  // 4:5 вистачає на ~130 символів дрібнішим шрифтом, тож довгу назву
  // зменшуємо, а ріжемо лише понад це — і по межі слова.
  const shown = cutTitle(title, 130);
  const titleSize = shown.length > 88 ? 58 : shown.length > 52 ? 66 : 82;

  const lockup = await logo();

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', padding: '84px 72px',
        backgroundColor: CREAM,
        // «Кремовий у клітинку» — фон бренд-кіту для постів і каруселей.
        // Лінія в кіті — rgba(26,26,26,0.045) на кремовому; satori не розбирає
        // rgba у списку градієнтів, тож той самий колір суцільним — це BORDER.
        backgroundImage:
          `linear-gradient(${BORDER} 2px, transparent 2px),`
          + `linear-gradient(90deg, ${BORDER} 2px, transparent 2px)`,
        backgroundSize: '54px 54px',
        fontFamily: 'Manrope',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{
            display: 'flex', alignSelf: 'flex-start', fontSize: 26, fontWeight: 500,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            color: TEAL_INK, backgroundColor: TEAL, borderRadius: 999, padding: '12px 28px',
          }}>{typeLabel}</div>
          {deadline ? (
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: ORANGE_TEXT }}>
              {deadline}
            </div>
          ) : null}
        </div>

        <div style={{
          display: 'flex', fontSize: titleSize, fontWeight: 500,
          color: INK, lineHeight: 1.12, letterSpacing: '-0.025em',
        }}>{shown}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {chips.map((chip) => (
              <div key={chip} style={{
                display: 'flex', fontSize: 28, fontWeight: 500, color: INK_SOFT,
                backgroundColor: '#ffffff', border: `2px solid ${BORDER}`,
                borderRadius: 999, padding: '10px 22px',
              }}>{chip}</div>
            ))}
          </div>
          {lockup ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={lockup} width={404} height={90} alt="dityam.com.ua" />
          ) : (
            <div style={{ display: 'flex', fontSize: 34, fontWeight: 700, color: ORANGE_TEXT }}>
              dityam.com.ua
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1080, height: 1350, fonts: await fonts() },
  );
}
