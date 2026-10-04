'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SLIDE_MS, nextIndex, prevIndex, shouldAutoPlay, swipeTo } from '@/lib/top-week-slider';

/**
 * «Топ тижня» — одна велика картка, що по черзі показує кожну з трьох.
 *
 * Марія, 04.10.2026: «1 можливість яку чітко видно… бо ми це продаємо, а
 * зараз це тупо». Було три дрібні рядки, де назва ламалась на два рядки
 * дев'ятим кеглем: ні прочитати, ні показати організаторові за гроші.
 *
 * Правила каруселі, які тут не прикраса:
 *   • спиняється під мишею й на фокусі — інакше людина не встигає натиснути;
 *   • після першого ручного перемикання не крутиться взагалі: далі вирішує
 *     людина, а не таймер;
 *   • поважає prefers-reduced-motion;
 *   • крапки — справжні кнопки з підписами, а не декоративні діви;
 *   • усі три картки лишаються в розмітці (прихована — aria-hidden +
 *     inert), тож пошуковик і читач екрана бачать усі три, а не одну.
 *
 * Логіка перемикання — у lib/top-week-slider.js, щоб її перевіряв тест.
 *
 * Приймає ГОТОВІ рядки (day/month/meta), а не функції-рендери: блок стоїть і
 * на головній (клієнтський хіро), і в кожній підбірці (серверна сторінка), а
 * функцію через межу сервер → клієнт не передати.
 */
export default function TopWeekSlider({ cards = [], title, allHref, allLabel, lang = 'uk' }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touched, setTouched] = useState(false);
  const [reduced, setReduced] = useState(false);
  const startX = useRef(null);
  const total = cards.length;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!shouldAutoPlay({ total, paused, touched, reducedMotion: reduced })) return undefined;
    const timer = setInterval(() => setI((v) => nextIndex(v, total)), SLIDE_MS);
    return () => clearInterval(timer);
  }, [total, paused, touched, reduced]);

  if (!total) return null;

  const go = (n) => { setTouched(true); setI(n); };
  const isEn = lang === 'en';

  return (
    <aside
      className="v2-tw"
      aria-labelledby="v2-tw-title"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => { startX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (startX.current === null) return;
        const end = e.changedTouches[0]?.clientX ?? startX.current;
        const to = swipeTo(startX.current, end, i, total);
        startX.current = null;
        if (to !== i) go(to);
      }}
    >
      <div className="v2-tw-head">
        <span id="v2-tw-title" className="v2-tw-title">{title}</span>
        {total > 1 ? (
          <span className="v2-tw-count" aria-hidden="true">{i + 1}/{total}</span>
        ) : null}
      </div>

      <div className="v2-tw-stage">
        {cards.map((o, n) => (
          <Link
            key={o.slug}
            href={`${isEn ? '/en' : ''}/o/${o.slug}`}
            className={`v2-tw-card${n === i ? ' is-on' : ''}`}
            aria-hidden={n === i ? undefined : 'true'}
            tabIndex={n === i ? undefined : -1}
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
        {total > 1 ? (
          <div className="v2-tw-dots" role="group" aria-label={isEn ? 'Switch opportunity' : 'Перемкнути можливість'}>
            <button
              type="button"
              className="v2-tw-arrow"
              aria-label={isEn ? 'Previous' : 'Попередня'}
              onClick={() => go(prevIndex(i, total))}
            >
              ‹
            </button>
            {cards.map((o, n) => (
              <button
                key={o.slug}
                type="button"
                className={`v2-tw-dot${n === i ? ' is-on' : ''}`}
                aria-label={`${isEn ? 'Opportunity' : 'Можливість'} ${n + 1}`}
                aria-current={n === i ? 'true' : undefined}
                onClick={() => go(n)}
              />
            ))}
            <button
              type="button"
              className="v2-tw-arrow"
              aria-label={isEn ? 'Next' : 'Наступна'}
              onClick={() => go(nextIndex(i, total))}
            >
              ›
            </button>
          </div>
        ) : <span />}
        {allHref && allLabel ? (
          <Link href={allHref} className="v2-tw-all">{allLabel}</Link>
        ) : null}
      </div>
    </aside>
  );
}
