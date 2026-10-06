'use client';
import Link from 'next/link';
import { useState } from 'react';

/**
 * «Топ 3 цього тижня» на телефоні — три компактні картки прокруткою вбік.
 *
 * Марія, 05.10.2026: «де 3 карточки обережно видно на мобільному — мають бути
 * видно у підбірках так само, як на головній сторінці, а зараз там теж
 * величезний слайдер». На головній ця смужка вже була (всередині
 * OpportunitiesList), у підбірках же стояв той самий блок, що й на десктопі:
 * три великі картки одна під одною на ~700px перед списком.
 *
 * Тепер розмітка одна на обидва місця. Великий блок (app/TopWeekSlider.js)
 * лишається на широких екранах — на телефоні його ховає CSS.
 *
 * Дані приходять із sliderCards() (lib/top-week-slider.js) — тієї самої
 * функції, що годує великий блок. Інакше підписи в двох виглядах колись
 * розійшлися б, а це те, що ми продаємо організаторам.
 */
const T = {
  uk: { swipe: 'листайте →' },
  en: { swipe: 'swipe →' },
};

export default function TopWeekStrip({ cards = [], title, lang = 'uk' }) {
  // Який із трьох зараз по центру — лише для підпису «2 / 3». Рахується з
  // прокрутки, а не зі стану: смужку гортають пальцем, кнопок тут немає.
  const [i, setI] = useState(0);
  if (cards.length !== 3) return null;
  const t = T[lang] || T.uk;
  const isEn = lang === 'en';

  return (
    <section className="m-top" aria-labelledby="m-top-title">
      <div className="m-top-head">
        <h2 id="m-top-title">{title}</h2>
        <span aria-hidden="true">{`${i + 1} / ${cards.length} · ${t.swipe}`}</span>
      </div>
      <div
        className="m-top-strip"
        onScroll={(e) => {
          // 272 = ширина картки (250) плюс проміжок (12) плюс половина, щоб
          // підпис перемикався посеред картки, а не на самому краю.
          const n = Math.round(e.currentTarget.scrollLeft / 272);
          setI(Math.min(cards.length - 1, Math.max(0, n)));
        }}
      >
        {cards.map((o) => (
          <Link
            key={o.slug}
            href={o.href || `${isEn ? '/en' : ''}/o/${o.slug}`}
            className="m-top-card"
            // Назва лишилась українською на англійській сторінці — кажемо це
            // браузеру, інакше синтезатор мови читає її як англійську.
            lang={o.titleIsUk ? 'uk' : undefined}
          >
            <span className="v2-soon-date" aria-hidden="true">
              {o.day ? (
                <>
                  <span className="v2-soon-day">{o.day}</span>
                  <span className="v2-soon-month">{o.month}</span>
                </>
              ) : <span className="v2-soon-month">{o.dateLabel}</span>}
            </span>
            <span className="m-top-text">
              <span className="m-top-name">{o.title}</span>
              <span className="m-top-meta">{o.meta}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
