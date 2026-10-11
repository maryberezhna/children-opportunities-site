// Подяка педагогу — картинка A4 (портрет 1240×1754), як і диплом учасника,
// але дорослого вигляду (Марія, 11.10.2026, на основі варіанта C): рамка з
// градієнтом від темно-синього до помаранчевого, кремовий аркуш із тонкою
// золотою лінією, «ПОДЯКА» шрифтом із засічками. Дитячий дизайн (хмара,
// монстрики) лишився лише на дипломах дітей.
//
// Видається один раз — коли за посиланням педагога олімпіаду пройде
// TEACHER_THANKS_AT учнів (lib/olimpiada.js). Числа учнів на подяці немає, а
// дата — місяць і рік thanks_sent_at, тож картинка більше не змінюється: лист
// бере її звідси в мить видачі, а маршрут /api/olimpiada/diploma?kind=teacher
// віддає її з довгим кешем CDN.
//
// Без медалі й будь-яких монограм (Марія, 11.10.2026: медаль із «D» —
// ніколи, ні в яких дизайнах). Єдиний знак — лого.
// Лого — як на сайті: «dityam.com.ua» шрифтом Caveat у брендовому
// помаранчевому (Марія: «наше лого завжди пишеться каветом і в брендових
// кольорах»). Курсиву Caveat у шрифтах next/og немає — звичайний жирний.
// Lora SemiBold (кирилиця) — з github.com/cyrealtype/Lora-Cyrillic, OFL.
import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { teacherName, teacherThanksDate, teacherThanksNo } from './olimpiada.js';

export const THANKS_W = 1240;
export const THANKS_H = 1754;

const NAVY = '#14254a';
const CREAM = '#fbf8f1';
const GOLD_LINE = '#d9b77a';
const ORANGE = '#e85d24';
// Рамка — градієнт від темно-синього до брендового помаранчевого (Марія,
// 11.10.2026, варіант 2 з teacher2/gradients.html): синій угорі ліворуч,
// помаранчевий унизу праворуч. backgroundColor під ним — запас.
const FRAME = 'linear-gradient(135deg, #14254a 0%, #3a3f8f 45%, #e85d24 100%)';

const fontDir = path.join(process.cwd(), 'public', 'fonts');

// Довге імʼя — дрібніше, щоб уміститись у 2 рядки (до 60 знаків, teacherName).
const nameSize = (name) => (name.length > 44 ? 66 : name.length > 30 ? 76 : 92);

function sheet({ name, date, no, k }) {
  const px = (n) => Math.round(n * k);
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', backgroundColor: NAVY, backgroundImage: FRAME, padding: px(62), fontFamily: 'Manrope' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', backgroundColor: CREAM,
        padding: `${px(110)}px ${px(112)}px ${px(100)}px`, textAlign: 'center' }}>
        <div style={{ position: 'absolute', left: px(20), top: px(20), right: px(20), bottom: px(20), border: `${px(3)}px solid ${GOLD_LINE}`, display: 'flex' }} />

        <div style={{ display: 'flex', fontFamily: 'Caveat', fontWeight: 700, fontSize: px(64), color: ORANGE, lineHeight: 1 }}>dityam.com.ua</div>

        {/* Розрядка додає відступ і після останньої літери — зсуваємо назад, щоб слово стояло по центру. */}
        <div style={{ display: 'flex', marginTop: px(150), fontFamily: 'Lora', fontWeight: 600, fontSize: px(150), color: NAVY, letterSpacing: '0.18em', paddingLeft: '0.18em', lineHeight: 1.1 }}>ПОДЯКА</div>

        <div style={{ display: 'flex', marginTop: px(64), fontSize: px(36), fontWeight: 500, color: '#6b6b6b', letterSpacing: '0.12em', paddingLeft: '0.12em' }}>НАГОРОДЖУЄТЬСЯ</div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: px(28), maxWidth: px(920), fontFamily: 'Lora', fontWeight: 600,
          fontSize: px(nameSize(name)), color: '#1a1a1a', lineHeight: 1.2, textAlign: 'center' }}>{name}</div>

        {/* Рядки розбито вручну: satori переносить «Онлайн-» і «олімпіади» на різні рядки. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: px(70), fontSize: px(40), fontWeight: 500, color: '#333333', lineHeight: 1.55 }}>
          <div style={{ display: 'flex' }}>за залучення учнів до онлайн-олімпіади</div>
          <div style={{ display: 'flex' }}>з логіки та внесок у розвиток</div>
          <div style={{ display: 'flex' }}>їхнього логічного мислення</div>
        </div>

        <div style={{ display: 'flex', marginTop: 'auto', width: '100%', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: px(31), fontWeight: 500, color: '#444444' }}>
          {/* Номер — як на дипломі дитини: дрібно й сіро під датою. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginBottom: px(4) }}>
            <div style={{ display: 'flex' }}>{date}</div>
            {no ? <div style={{ display: 'flex', marginTop: px(6), fontSize: px(24), color: '#8a8a8a' }}>{no}</div> : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontFamily: 'Caveat', fontWeight: 700, fontSize: px(86), color: '#2b2b2b', lineHeight: 1 }}>Марія Шутяк</div>
            <div style={{ display: 'flex', marginTop: px(6) }}>засновниця Dityam.com.ua</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Подяка як ImageResponse. name — як вписав педагог (називний відмінок),
 * date — рядок на кшталт «Жовтень 2026», no — «№ ПД-XXXXXXXX» або «зразок». k — масштаб (зразок і показ на
 * екрані — менші).
 */
export async function renderThanks({ name, date, no = null, k = 1 }) {
  const [medium, bold, hand, serif] = await Promise.all([
    readFile(path.join(fontDir, 'Manrope-Medium.ttf')),
    readFile(path.join(fontDir, 'Manrope-Bold.ttf')),
    readFile(path.join(fontDir, 'Caveat-Bold.ttf')),
    readFile(path.join(fontDir, 'Lora-SemiBold.ttf')),
  ]);
  return new ImageResponse(sheet({ name, date, no, k }), {
    width: Math.round(THANKS_W * k),
    height: Math.round(THANKS_H * k),
    fonts: [
      { name: 'Manrope', data: medium, weight: 500, style: 'normal' },
      { name: 'Manrope', data: bold, weight: 700, style: 'normal' },
      { name: 'Caveat', data: hand, weight: 700, style: 'normal' },
      { name: 'Lora', data: serif, weight: 600, style: 'normal' },
    ],
  });
}

/** PNG подяки для вкладення в лист: педагог із уже поставленим thanks_sent_at. */
export async function thanksPng(teacher) {
  const name = teacherName(teacher?.name);
  if (!name || !teacher?.thanks_sent_at) return null;
  const no = teacherThanksNo(teacher);
  const res = await renderThanks({ name, date: teacherThanksDate(teacher.thanks_sent_at), no: no ? `№ ${no}` : null });
  return Buffer.from(await res.arrayBuffer());
}
