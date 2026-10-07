'use client';
import Link from 'next/link';
import { sendSiteEvent, SITE_EVENTS } from '@/lib/site-events';

/**
 * «Топ 3 цього тижня» — рейтинг: три місця з великими цифрами 1, 2, 3.
 *
 * Історія, щоб не ходити по колу:
 *   • до 04.10.2026 — три дрібні рядки, назва ламалась дев'ятим кеглем;
 *   • 04.10 — одна велика картка, що сама перемикається (Марія: «1 можливість
 *     яку чітко видно… бо ми це продаємо, а зараз це тупо»);
 *   • 07.10 — «чому слайдер не працює, має бути одразу видно, що це слайдер»:
 *     картки мінялись на місці, і що їх три, видно не було. Стрічка з краєм
 *     наступної картки й стрілками — «не подобається дизайн… придумай якось
 *     краще, все таки це топ 3». З трьох показаних варіантів Марія обрала
 *     рейтинг: гортати три пункти нема чого, а цифри 1, 2, 3 і кажуть «топ».
 *
 * Тому слайдера тут більше немає, і повертати його не треба: усі три місця
 * видно однаково, жодне оплачене не ховається «за кадром». Назва файлу
 * лишилась від каруселі — її імпортують головна, підбірки й тести.
 *
 * Приймає ГОТОВІ рядки (day/month/meta), а не функції-рендери: блок стоїть і
 * на головній (клієнтський хіро), і в кожній підбірці (серверна сторінка), а
 * функцію через межу сервер → клієнт не передати.
 *
 * Два розклади, бо місця різні (Марія, 04.10.2026):
 *   • вузький (головна, права колонка хіро) — рейтинг стовпчиком;
 *   • широкий (підбірка, вся ширина) — «там можна всі 3 помістити»: три
 *     картки поруч.
 */
export default function TopWeekSlider({ cards = [], title, allHref, allLabel, lang = 'uk', all = false }) {
  if (!cards.length) return null;
  const isEn = lang === 'en';

  // Картка олімпіади — у статистику сторінки олімпіади (/admin/metrics).
  const clickOf = (o) => (o.href === '/olimpiada'
    ? () => sendSiteEvent(SITE_EVENTS.OLIMP_TOP_CLICK, window.location.pathname)
    : undefined);

  return (
    <aside className={`v2-tw${all ? ' v2-tw--all' : ''}`} aria-labelledby="v2-tw-title">
      <span id="v2-tw-title" className="v2-tw-title">{title}</span>

      {all ? (
        <div className="v2-tw-grid">
          {cards.map((o) => (
            <Link key={o.slug} href={o.href || `${isEn ? '/en' : ''}/o/${o.slug}`} onClick={clickOf(o)} className="v2-tw-card">
              <span className="v2-tw-date">
                {o.day ? <><b>{o.day}</b> {o.month}</> : o.dateLabel}
              </span>
              <span className="v2-tw-name" lang={o.titleIsUk ? 'uk' : undefined}>{o.title}</span>
              <span className="v2-tw-meta">{o.meta}</span>
              <span className="v2-tw-more" aria-hidden="true">
                {isEn ? 'See details →' : 'Детальніше →'}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        // role="list": Safari з list-style: none перестає читати <ol> як
        // список, і читач екрана не каже «1 з 3».
        <ol className="v2-tw-list" role="list">
          {cards.map((o, n) => (
            <li key={o.slug}>
              <Link href={o.href || `${isEn ? '/en' : ''}/o/${o.slug}`} onClick={clickOf(o)} className="v2-tw-row">
                {/* Місце вже каже сам <ol>, цифра — для очей. */}
                <span className="v2-tw-num" aria-hidden="true">{n + 1}</span>
                <span className="v2-tw-body">
                  <span className="v2-tw-name" lang={o.titleIsUk ? 'uk' : undefined}>{o.title}</span>
                  <span className="v2-tw-meta">
                    {/* Дата — дедлайн подачі (sliderCards бере deadline), тож
                        «до 9 жовт». Без дати — підпис на кшталт «Скоро старт». */}
                    <span className="v2-tw-when">
                      {o.day ? `${isEn ? 'by' : 'до'} ${o.day} ${o.month}` : o.dateLabel}
                    </span>
                    {o.meta ? ` · ${o.meta}` : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}

      {allHref && allLabel ? (
        <Link href={allHref} className="v2-tw-all">{allLabel}</Link>
      ) : null}
    </aside>
  );
}
