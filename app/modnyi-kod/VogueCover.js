// Обкладинка «Модного коду» у стилі Vogue (Марія, 12.10.2026: «візьми стиль з
// Vogue» → обрала варіант A, «супер»). Суцільне тло зі студійним світлом,
// логотип dityam.com.ua на всю ширину за головою, тонка лінія з номером
// випуску, анонси з засічками: лук сезону, «у луку» (речі з образу дитини),
// бали й гасло; імʼя великим, штрихкод. Анонси — з образу самої дитини.
import { lookSvg, PIECES } from '@/lib/modnyi-kod-looks';

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

export default function VogueCover({ look, theme = 'pink', title, score = '?/25', name, age, word = '', example = false, className = '' }) {
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
        <p className="vc-motto">Сміливість — головний тренд сезону</p>
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
