'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { sendSiteEvent, SITE_EVENTS } from '@/lib/site-events';
import { SLIDE_MS, indexAtScroll, nextIndex, prevIndex, shouldAutoPlay } from '@/lib/top-week-slider';

/**
 * «Топ тижня» — стрічка з трьох великих карток, з якої видно край наступної.
 *
 * Марія, 04.10.2026: «1 можливість яку чітко видно… бо ми це продаємо, а
 * зараз це тупо». Було три дрібні рядки, де назва ламалась на два рядки
 * дев'ятим кеглем: ні прочитати, ні показати організаторові за гроші.
 *
 * Марія, 07.10.2026: «чому слайдер не працює, має бути одразу видно, що це
 * слайдер». Перемикався він і тоді, але цього не було видно: картки лежали
 * стосом і мінялись на місці, під мишею блок мовчки ставав, стрілки були
 * сірими значками в 20px, а свайп тачпадом не робив нічого — ловились лише
 * дотики пальця, а на телефоні цього блоку якраз і немає. Тепер:
 *   • картки стоять у ряд, і край наступної видно праворуч — це і є «слайдер»;
 *   • стрічка гортається сама собою: тачпадом, пальцем, табом;
 *   • стрілки — круглі кнопки нагорі;
 *   • по активній крапці біжить смужка часу до наступної картки, а під мишею
 *     вона спиняється — видно, що блок чекає, а не зламався.
 *
 * Правила каруселі, які тут не прикраса:
 *   • спиняється під мишею й на фокусі — інакше людина не встигає натиснути
 *     (пауза — це пауза анімації смужки в CSS, а таймер і є та смужка, тож
 *     вони не розходяться);
 *   • після першого ручного перемикання не крутиться взагалі: далі вирішує
 *     людина, а не таймер;
 *   • поважає prefers-reduced-motion;
 *   • крапки — справжні кнопки з підписами, а не декоративні діви;
 *   • усі три картки — звичайні посилання в розмітці, тож пошуковик і читач
 *     екрана бачать усі три, а не одну.
 *
 * Логіка перемикання — у lib/top-week-slider.js, щоб її перевіряв тест.
 *
 * Приймає ГОТОВІ рядки (day/month/meta), а не функції-рендери: блок стоїть і
 * на головній (клієнтський хіро), і в кожній підбірці (серверна сторінка), а
 * функцію через межу сервер → клієнт не передати.
 *
 * Два розклади, бо місця різні (Марія, 04.10.2026):
 *   • вузький (головна, права колонка хіро) — стрічка, що гортається;
 *   • широкий (підбірка, вся ширина) — «там можна всі 3 помістити»: три
 *     картки поруч, без каруселі. Одна картка на всю ширину виглядала
 *     порожньою коробкою, а крутити те, що й так уміщається, нема сенсу.
 */
export default function TopWeekSlider({ cards = [], title, allHref, allLabel, lang = 'uk', all = false }) {
  const [i, setI] = useState(0);
  const [touched, setTouched] = useState(false);
  const [reduced, setReduced] = useState(false);
  const track = useRef(null);
  const total = cards.length;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (!total) return null;

  // Позиції карток рахуємо від першої: перед нею внутрішній відступ стрічки.
  const offsets = () => {
    const els = [...(track.current?.children || [])];
    return els.map((el) => el.offsetLeft - els[0].offsetLeft);
  };

  const show = (n) => {
    const el = track.current;
    if (el) el.scrollTo({ left: offsets()[n] ?? 0, behavior: reduced ? 'auto' : 'smooth' });
    setI(n);
  };
  const go = (n) => { setTouched(true); show(n); };

  const slider = total > 1 && !all;
  const auto = slider && shouldAutoPlay({ total, touched, reducedMotion: reduced });
  const isEn = lang === 'en';

  return (
    <aside className={`v2-tw${all ? ' v2-tw--all' : ''}`} aria-labelledby="v2-tw-title">
      <div className="v2-tw-head">
        <span id="v2-tw-title" className="v2-tw-title">{title}</span>
        {slider ? (
          <div className="v2-tw-arrows">
            <button
              type="button"
              className="v2-tw-arrow"
              aria-label={isEn ? 'Previous' : 'Попередня'}
              onClick={() => go(prevIndex(i, total))}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </button>
            <button
              type="button"
              className="v2-tw-arrow"
              aria-label={isEn ? 'Next' : 'Наступна'}
              onClick={() => go(nextIndex(i, total))}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={track}
        className="v2-tw-track"
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(indexAtScroll(el.scrollLeft, offsets(), el.scrollWidth - el.clientWidth));
        }}
        // Людина гортає сама — тачпадом убік чи пальцем: таймер більше не
        // втручається. Вертикальне колесо над блоком гортає сторінку, його
        // не рахуємо.
        onWheel={(e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) setTouched(true); }}
        onTouchStart={() => setTouched(true)}
      >
        {cards.map((o, n) => (
          <Link
            key={o.slug}
            href={o.href || `${isEn ? '/en' : ''}/o/${o.slug}`}
            // Картка олімпіади — у статистику сторінки олімпіади (/admin/metrics).
            onClick={o.href === '/olimpiada' ? () => sendSiteEvent(SITE_EVENTS.OLIMP_TOP_CLICK, window.location.pathname) : undefined}
            className="v2-tw-card"
          >
            <span className="v2-tw-date">
              {o.day ? <><b>{o.day}</b> {o.month}</> : o.dateLabel}
            </span>
            <span className="v2-tw-name">{o.title}</span>
            <span className="v2-tw-meta">{o.meta}</span>
            <span className="v2-tw-more" aria-hidden="true">
              {isEn ? 'See details →' : 'Детальніше →'}
            </span>
          </Link>
        ))}
      </div>

      <div className="v2-tw-foot">
        {slider ? (
          <div className="v2-tw-dots" role="group" aria-label={isEn ? 'Switch opportunity' : 'Перемкнути можливість'}>
            {cards.map((o, n) => (
              <button
                key={o.slug}
                type="button"
                className={`v2-tw-dot${n === i ? ' is-on' : ''}${n === i && auto ? ' is-auto' : ''}`}
                aria-label={`${isEn ? 'Opportunity' : 'Можливість'} ${n + 1}`}
                aria-current={n === i ? 'true' : undefined}
                onClick={() => go(n)}
              >
                <span className="v2-tw-pip">
                  {n === i && auto ? (
                    // Смужка часу і є таймер: картка міняється, коли вона
                    // добігає. Під мишею CSS ставить її на паузу — і таймер
                    // разом із нею.
                    <span
                      className="v2-tw-fill"
                      style={{ animationDuration: `${SLIDE_MS}ms` }}
                      onAnimationEnd={() => show(nextIndex(i, total))}
                    />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : <span />}
        {allHref && allLabel ? (
          <Link href={allHref} className="v2-tw-all">{allLabel}</Link>
        ) : null}
      </div>
    </aside>
  );
}
