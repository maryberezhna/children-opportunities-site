// Обкладинка «Модного коду» у стилі Vogue (Марія, 12.10.2026: «візьми стиль з
// Vogue» → обрала варіант A, «супер»). Суцільне тло зі студійним світлом,
// логотип dityam.com.ua на всю ширину за головою, тонка лінія з номером
// випуску, анонси з засічками: лук сезону, «у луку» (речі з образу дитини),
// бали й гасло; імʼя великим, штрихкод. Анонси — з образу самої дитини.
import { lookSvg, PIECES } from '@/lib/modnyi-kod-looks';

// 5 гасел (Марія, 12.10.2026: «тут потрібні різні цитати, 5 наприклад
// основних»). Власні — не чужі цитати, щоб нікому нічого не приписати.
// Кожна дитина отримує своє: вибір за імʼям і назвою образу (стабільно).
export const MOTTOS = [
  'Сміливість — головний тренд сезону',
  'Мій стиль — мої правила',
  'Колір — це настрій, який видно',
  'Кожен образ — маленька історія',
  'Найкращий тренд — бути собою',
];
export function mottoFor(seed) {
  let h = 2166136261;
  for (const ch of String(seed || '')) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  // Тире не має починати рядок: нерозривний пробіл перед ним.
  return MOTTOS[(h >>> 0) % MOTTOS.length].replace(' — ', '\u00A0— ');
}

export const COVER_THEMES = {
  pink: { name: 'пудрове', bg: '#f3d6da', acc: '#b0003a' },
  lavender: { name: 'лавандове', bg: '#dcd6f0', acc: '#5a2a8a' },
  blue: { name: 'блакитне', bg: '#d3e6f2', acc: '#123d73' },
};

// Як річ звучить в анонсі на обкладинці (Марія: «деякі назви не дуже гарні»).
const COVER_NAMES = { dress1: 'коротка сукня', dress2: 'довга сукня', oversize: 'оверсайз', jersey: 'джерсі', track: 'олімпійка', balloon: 'джинси-бульбашки', block: 'підбор-блок', heels: 'шпильки', mary: 'туфлі' };

/** «оверсайз · плісе · лофери» — речі з образу, малими літерами. */
export function inLook(look) {
  const keys = look.base === 'set' ? [['top', look.top], ['bottom', look.bottom]] : [['base', look.base]];
  if (look.outer && look.outer !== 'none') keys.push(['outer', look.outer]);
  keys.push(['shoes', look.shoes]);
  return keys.map(([k, v]) => COVER_NAMES[v] || String(PIECES[k].opts[v] || '').toLowerCase()).filter(Boolean).join(' · ');
}

export default function VogueCover({ look, theme = 'pink', title, score = '?/25', name, age, word = '', example = false, className = '', motto = null }) {
  const t = COVER_THEMES[theme] || COVER_THEMES.pink;
  return (
    <div className={`vc ${className}`} style={{ '--bg': t.bg, '--acc': t.acc }}>
      <div className="vc-top vc-small"><span>Випуск №1</span><span>Осінь 2026</span><span>Модний код</span></div>
      <div className="vc-mast">dityam.com.ua</div>
      <div className="vc-floor" />
      <svg className="vc-fig" viewBox="20 -6 160 452" preserveAspectRatio="xMidYMax meet" dangerouslySetInnerHTML={{ __html: lookSvg(look) }} />
      <div className="vc-col l">
        <p><span className="vc-small">Лук сезону</span><i>«{title || 'Твій образ'}»</i></p>
        <p className="vc-inlook"><span className="vc-small">У луку</span>{inLook(look)}</p>
      </div>
      <div className="vc-col r">
        <p><span className="vc-small">Модний код</span><b>{score}</b></p>
        <p className="vc-motto">{motto || mottoFor(`${name || ""}|${title || ""}`)}</p>
      </div>
      <div className="vc-who">
        {word ? <span className="vc-small">{word}</span> : null}
        {name ? <>{name}{age ? <em>, {age}</em> : null}</> : <em>Твоє імʼя</em>}
      </div>
      <div className="vc-bar"><i /><span>№1 · осінь 2026</span></div>
      {example ? <span className="vc-tag">Приклад</span> : null}
    </div>
  );
}
