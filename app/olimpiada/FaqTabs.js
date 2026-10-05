'use client';

// Питання вкладками, як на референсі: ліворуч перелік, праворуч відповідь.
// На телефоні відповідь розкривається одразу під своїм питанням.
import { useState } from 'react';

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
            {i === active && <p className="ol-faq-inline">{f.a}</p>}
          </li>
        ))}
      </ul>
      <div className="ol-faq-panel" id="ol-faq-panel" role="tabpanel" aria-labelledby={`ol-faq-tab-${active}`}>
        <h3>{current.q}</h3>
        <p>{current.a}</p>
      </div>
    </div>
  );
}
