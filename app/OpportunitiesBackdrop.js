'use client';
import { useEffect, useState } from 'react';

// Смуга з фоновим відео перед блоком можливостей.
//
// Відео стоїть НАД фільтрами й картками, а не під ними. Під ними його
// пробували б класти заради ефекту «фон каталогу», але там щільний
// функціональний інтерфейс: чипи фільтрів і текст карток на рухомому кадрі
// не читаються, а щоб вони читались, відео довелось би затемнити майже до
// суцільного кольору — і сенс відео зникає. Тому смуга живе окремо: на ній
// заголовок, під нею — чистий фон і робочий інтерфейс.
//
// Саме відео — коштовна прикраса, і вмикається воно далеко не всім:
//
// 1. Телефон не вантажить його взагалі. Пара мегабайт поверх карток псує
//    завантаження саме тим, заради кого зроблений сайт, — родинам поза
//    великими містами, які сидять із телефона на слабкому інтернеті.
// 2. prefers-reduced-motion: reduce — лишається нерухомий постер. Для когось
//    рух на сторінці це не «жвавіше», а нудота й головний біль.
// 3. Save-Data (економія трафіку в браузері) — теж лише постер.
//
// Постер стоїть на місці відео завжди, тож смуга не блимає порожнечею, поки
// відео вантажиться, і не ламається, якщо воно не завантажиться зовсім.
export default function OpportunitiesBackdrop({
  title,
  subtitle,
  poster = '/backdrop.jpg',
  webm = '/backdrop.webm',
  mp4 = '/backdrop.mp4',
}) {
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    const wideEnough = window.matchMedia('(min-width: 900px)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    const decide = () => {
      const saveData = navigator.connection?.saveData === true;
      setPlayVideo(wideEnough.matches && !reduced.matches && !saveData);
    };
    decide();

    // Поворот планшета чи вимкнена анімація в системі мають спрацьовувати
    // одразу, а не з наступного заходу на сайт.
    wideEnough.addEventListener('change', decide);
    reduced.addEventListener('change', decide);
    return () => {
      wideEnough.removeEventListener('change', decide);
      reduced.removeEventListener('change', decide);
    };
  }, []);

  return (
    <section className="opps-backdrop">
      <img className="opps-backdrop-media" src={poster} alt="" aria-hidden="true" />
      {playVideo ? (
        <video
          className="opps-backdrop-media opps-backdrop-video"
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src={webm} type="video/webm" />
          <source src={mp4} type="video/mp4" />
        </video>
      ) : null}
      <div className="opps-backdrop-scrim" aria-hidden="true" />
      <div className="opps-backdrop-copy">
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </section>
  );
}
