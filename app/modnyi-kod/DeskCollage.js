// «Стіл дизайнера» на першому екрані «Модного коду» — як макет C, який Марія
// показала скриншотом («ні, в нас має бути така сторінка нормальна, як у
// олімпіади з логіки»): палітра сезону, клаптики тканин, шаблон фігури з
// образом, манекен із драпіруванням, сантиметр, ножиці, котушки. Декор, тож
// aria-hidden; образ на шаблоні — та сама фігурка, що й у студії.
import { lookSvg, DEFS } from '@/lib/modnyi-kod-looks';

const LOOK = {
  base: 'set', top: 'tee', bottom: 'skirt', outer: 'none', shoes: 'boots', acc: 'bag',
  f: { top: 'denim', bottom: 'leo', shoes: '#2f7d63', acc: '#f5c518', legs: '#161616', base: 'polka', outer: 'hound', cover: 'tartan' },
};

// Краї клаптика «зигзагом», як після фігурних ножиць.
function zig(n) {
  const t = 7;
  let d = 'M0 0';
  for (let x = t; x <= n; x += t) d += ` L${x} ${(x / t) % 2 ? 4 : 0}`;
  for (let y = t; y <= n; y += t) d += ` L${n - ((y / t) % 2 ? 4 : 0)} ${y}`;
  for (let x = n - t; x >= 0; x -= t) d += ` L${x} ${n - ((x / t) % 2 ? 4 : 0)}`;
  for (let y = n - t; y >= 0; y -= t) d += ` L${(y / t) % 2 ? 4 : 0} ${y}`;
  return `${d}Z`;
}
const Svg = ({ html, viewBox, className, style }) => (
  <svg viewBox={viewBox} className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />
);
const Swatch = ({ f, name, style }) => (
  <div className="dk-sw" style={style}>
    <Svg viewBox="0 0 112 112" html={`<path d="${zig(112)}" fill="url(#${f})" stroke="rgba(0,0,0,.25)"/>`} />
    <span>{name}</span>
  </div>
);
const Chip = ({ c, name, style }) => <div className="dk-chip" style={style}><i style={{ background: c }} />{name}</div>;

const DRESS_FORM = `<path d="M100 330 v50 M70 386 h60" stroke="#5b3a29" stroke-width="7" stroke-linecap="round"/>
<path d="M66 30 q34 -16 68 0 q10 40 -6 80 q-6 40 14 90 q8 60 -12 130 h-60 q-20 -70 -12 -130 q20 -50 14 -90 q-16 -40 -6 -80z" fill="#e9d9bf" stroke="#1a1a1a" stroke-width="2.4"/>
<path d="M100 12 v20" stroke="#5b3a29" stroke-width="7"/><circle cx="100" cy="10" r="7" fill="#5b3a29"/>
<path d="M60 60 q50 30 84 -20 q10 80 -14 150 q-30 90 -70 120 q10 -100 -10 -150z" fill="url(#tartan)" stroke="#1a1a1a" stroke-width="2.4"/>
<circle cx="74" cy="66" r="5" fill="#d6336c"/><circle cx="128" cy="52" r="5" fill="#f5c518"/>`;
const TAPE = `<path d="M0 40 C 140 -10, 260 90, 400 40 S 640 0, 720 50" fill="none" stroke="#f5c518" stroke-width="26"/>
<path d="M0 40 C 140 -10, 260 90, 400 40 S 640 0, 720 50" fill="none" stroke="#1a1a1a" stroke-width="12" stroke-dasharray="1.5 9" opacity=".7"/>`;
const SCISSORS = `<path d="M40 46 L118 18 M40 46 L118 70" stroke="#9aa3ad" stroke-width="7" stroke-linecap="round"/>
<circle cx="22" cy="28" r="14" fill="none" stroke="#e85d24" stroke-width="7"/><circle cx="22" cy="64" r="14" fill="none" stroke="#e85d24" stroke-width="7"/>`;
const spool = (c) => `<rect x="2" y="2" width="42" height="9" rx="2" fill="#d8b98a"/><rect x="2" y="53" width="42" height="9" rx="2" fill="#d8b98a"/>
<rect x="7" y="11" width="32" height="42" fill="${c}"/><path d="M7 18 h32 M7 26 h32 M7 34 h32 M7 42 h32" stroke="rgba(255,255,255,.35)" stroke-width="2"/>`;
const PINS = '<path d="M10 50 L40 14 M30 56 L60 22" stroke="#9aa3ad" stroke-width="2.5"/><circle cx="40" cy="14" r="6" fill="#d6336c"/><circle cx="60" cy="22" r="6" fill="#1fa5a0"/>';

export default function DeskCollage() {
  return (
    <div className="dk" aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }} dangerouslySetInnerHTML={{ __html: `<defs>${DEFS}</defs>` }} />
      <Chip c="#c8501a" name="ГАРБУЗ 2026" style={{ left: '1%', top: '4%', transform: 'rotate(-4deg)' }} />
      <Chip c="#7a3fbf" name="ЧОРНИЦЯ" style={{ left: '15%', top: '2%', transform: 'rotate(3deg)' }} />
      <Chip c="#1fa5a0" name="МОРСЬКА ХВИЛЯ" style={{ left: '3%', top: '24%', transform: 'rotate(2deg)' }} />
      <Chip c="#f5c518" name="КУЛЬБАБА" style={{ left: '17%', top: '25%', transform: 'rotate(-3deg)' }} />
      <Svg viewBox="0 0 70 60" className="dk-pins" html={PINS} />
      <Swatch f="hound" name="гусяча лапка" style={{ left: '1%', top: '47%', transform: 'rotate(-6deg)' }} />
      <Swatch f="leo" name="леопард" style={{ left: '17%', top: '63%', transform: 'rotate(7deg)' }} />
      <div className="dk-sheet">
        <div className="dk-cap"><span>Шаблон фігури</span><span>Лук №1</span></div>
        <Svg viewBox="0 0 200 440" className="dk-fig" html={lookSvg(LOOK)} />
        <span className="dk-note" style={{ right: '-6%', top: '30%', transform: 'rotate(8deg)' }}>денім!</span>
        <span className="dk-note" style={{ left: '-4%', top: '62%', transform: 'rotate(-6deg)' }}>леопард ♥</span>
      </div>
      <div className="dk-tape" style={{ left: '38%', top: '3%', transform: 'rotate(-8deg)' }} />
      <div className="dk-tape" style={{ left: '56%', top: '5%', transform: 'rotate(10deg)' }} />
      <Svg viewBox="0 0 200 400" className="dk-form" html={DRESS_FORM} />
      <Swatch f="sequin" name="паєтки" style={{ left: '74%', top: '62%', transform: 'rotate(-9deg)' }} />
      <Svg viewBox="0 0 120 90" className="dk-scissors" html={SCISSORS} />
      <Svg viewBox="0 0 46 64" className="dk-spool s1" html={spool('#d6336c')} />
      <Svg viewBox="0 0 46 64" className="dk-spool s2" html={spool('#1fa5a0')} />
      <Svg viewBox="0 0 46 64" className="dk-spool s3" html={spool('#f5c518')} />
      <Svg viewBox="0 0 720 90" className="dk-tapemeasure" html={TAPE} />
    </div>
  );
}
