'use client';

// Питання вкладками, як на референсі: ліворуч перелік, праворуч відповідь.
// На телефоні відповідь розкривається одразу під своїм питанням.
import { useState } from 'react';

// `link` у питанні — слово з відповіді, яке стає посиланням (Марія, 06.10.2026:
// «додай посилання на Dityam+»). Сама відповідь лишається рядком: її ж бере
// розмітка FAQPage для пошуковиків.
function Answer({ item }) {
  const { a, link } = item;
  const at = link ? a.indexOf(link.text) : -1;
  if (at < 0) return a;
  return (
    <>
      {a.slice(0, at)}
      <a href={link.href}>{link.text}</a>
      {a.slice(at + link.text.length)}
    </>
  );
}

export default function FaqTabs({ items }) {
  const [active, setActive] = useState(0);
  const current = items[active];
  return (
    <div className="ol-faq">
      <ul className="ol-faq-tabs" role="tablist" aria-label="Питання">
        {items.map((f, i) => (
          <li key={f.q}>
            <button
              type="button" role="tab" id={`ol-faq-tab-${i}`} aria-selected={i === active} aria-controls="ol-faq-panel"
              className={`ol-faq-tab${i === active ? ' is-on' : ''}`} onClick={() => setActive(i)}
            >
              {f.q}
            </button>
            {i === active && <p className="ol-faq-inline"><Answer item={f} /></p>}
          </li>
        ))}
      </ul>
      <div className="ol-faq-panel" id="ol-faq-panel" role="tabpanel" aria-labelledby={`ol-faq-tab-${active}`}>
        <h3>{current.q}</h3>
        <p><Answer item={current} /></p>
      </div>
    </div>
  );
}
