import Link from 'next/link';
import { ownOpportunities, OWN_PATH, OWN_LABEL } from '@/lib/own-opportunities';

// «Наші можливості» — замість блоку однієї олімпіади з логіки (Марія,
// 14.10.2026: «заміни тут на наші можливості, як і на сторінці олімпіади, і
// всюди»). Стоїть на /olimpiady і в підбірках OWN_HUBS (lib/olimpiada.js).
// Перше речення — слова Марії з поста про олімпіаду. Стилі .ol-own —
// topic-v2.css (синій блок, як був).
export default function OwnPromo({ className = '' }) {
  const items = ownOpportunities();
  return (
    <section className={`ol-own${className ? ` ${className}` : ''}`} aria-labelledby="ol-own-title">
      <p className="ol-own-kicker">Від Dityam.com.ua</p>
      <h2 id="ol-own-title" className="ol-own-title">{OWN_LABEL}</h2>
      <p className="ol-own-text">Ми не тільки збираємо можливості для дітей, а й створюємо свої.</p>
      <ul className="ol-own-list">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} prefetch={false}>{it.label}</Link>
            <span> · {it.note}</span>
          </li>
        ))}
      </ul>
      <Link href={OWN_PATH} className="ol-own-btn" prefetch={false}>Усі наші можливості →</Link>
    </section>
  );
}
