// Обкладинка модного журналу dityam.com.ua: тло-тканина як рамка, логотип
// рукописом, малюнок дитини, назва образу й «Дизайнерка Соломія, 9».
// Розміри — у cqw (частка ширини самої обкладинки), тож та сама обкладинка
// однаково виглядає в галереї, на сторінці малюнка й у превʼю оплати.
import { FABRICS, fabricDataUri, designerLabel } from '@/lib/obraz-cover';
import { OBRAZ, yearsWord } from '@/lib/obraz';

export default function Cover({ fabric = 'tartan', title, name, age, designerWord, children, example = false, preview = false, className = '' }) {
  const f = FABRICS[fabric] || FABRICS.tartan;
  const label = designerLabel({ designer_word: designerWord });
  return (
    <div className={`cv ${className}`} style={{ backgroundImage: `url("${fabricDataUri(fabric, 600, 800)}")` }}>
      <div className="cv-in" style={{ background: f.band }}>
        <div className="cv-mast" style={{ color: f.accent }}>dityam.com.ua</div>
        <div className="cv-kick">{OBRAZ.season} · Kids Fashion</div>
        <div className="cv-art">
          {children}
          {title ? <div className="cv-title">«{title}»</div> : null}
        </div>
        <div className="cv-foot">
          <div className="cv-who">
            {label ? <small>{label}</small> : null}
            {example ? <span className="cv-who-ex">Імʼя, вік</span> : <>{name}, {age} <span className="cv-yrs">{yearsWord(age)}</span></>}
          </div>
          <div className="cv-bar" aria-hidden="true" />
        </div>
      </div>
      {example ? <span className="cv-tag">Приклад</span> : null}
      {preview ? <span className="cv-wm" aria-hidden="true">превʼю</span> : null}
    </div>
  );
}
