import Link from 'next/link';
import { OLIMP, OLIMP_OPEN } from '@/lib/olimpiada';

// Блок власної онлайн-олімпіади Dityam.com.ua у підбірках (Марія, 07.10.2026:
// «помісти на необхідні підбірки»). Списки підбірок наповнюються з бази самі,
// але олімпіада — наша сторінка, а не запис у базі, тож сама туди не потрапить.
// Де показувати — OLIMP_HUBS у lib/olimpiada.js; стилі .ol-own — topic-v2.css.
// Перехід звідси /admin/metrics покаже як «звідки прийшли: /<підбірка>».
export default function OlimpPromo({ abroad = false, className = '' }) {
  return (
    <section className={`ol-own${className ? ` ${className}` : ''}`} aria-labelledby="ol-own-title">
      <p className="ol-own-kicker">Від Dityam.com.ua · для дітей {OLIMP.groupLabel}</p>
      <h2 id="ol-own-title" className="ol-own-title">Онлайн-олімпіада з логіки</h2>
      <p className="ol-own-text">
        {OLIMP.questionCount} завдань на кмітливість за {OLIMP.minutes} хвилин і 1 відкрите без таймера — з телефона чи компʼютера
        {abroad ? ', з будь-якої країни' : ''}. Участь безкоштовна: кожен учасник одразу отримує диплом,
        а 3 найкращі відповіді щомісяця — призи.
      </p>
      <Link href="/olimpiada" className="ol-own-btn" prefetch={false}>
        {OLIMP_OPEN ? 'Взяти участь безкоштовно →' : 'Дізнатися й залишити email →'}
      </Link>
    </section>
  );
}
