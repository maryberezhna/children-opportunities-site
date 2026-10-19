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
/** «завтра» / «сьогодні» / «6 днів» — коротко, бо місця в картці мало. */
function leftLabel(days, isEn) {
  if (days === 0) return isEn ? 'today' : 'сьогодні';
  if (days === 1) return isEn ? 'tomorrow' : 'завтра';
  if (isEn) return `${days} days`;
  const last = days % 10;
  const tens = days % 100;
  if (last === 1 && tens !== 11) return `${days} день`;
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return `${days} дні`;
  return `${days} днів`;
}

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

      {/* Широкий розклад (підбірка й місто): три рівнозначні картки в рамці
          кольору бренду, на теплій підкладці. Марія, 19.10.2026: «вони всі
          рівнозначні… відповідають за монетизацію і скеровують трафік…
          мають виділятися і приковувати погляд». Тому жодної «головної»
          картки: однакові рамки, тіні й кнопки, а цифра лише задає порядок. */}
      {all ? (
        <div className="v2-tw-grid">
          {cards.map((o, n) => (
            <Link key={o.slug} href={o.href || `${isEn ? '/en' : ''}/o/${o.slug}`} onClick={clickOf(o)} className="v2-tw-card">
              <span className="v2-tw-rank" aria-hidden="true">{n + 1}</span>
              {(o.chips && o.chips.length) || (!o.day && o.dateLabel) ? (
                <span className="v2-tw-chips">
                  {/* Наш власний запис без дедлайну (олімпіада) має мітку
                      «Топ» — вона йде пігулкою, а не рядком «Дедлайн: Топ». */}
                  {!o.day && o.dateLabel ? (
                    <span className="v2-tw-chip is-pinned">{o.dateLabel}</span>
                  ) : null}
                  {(o.chips || []).map((c) => (
                    <span key={`${c.kind}-${c.text}`} className={`v2-tw-chip is-${c.kind}`}>{c.text}</span>
                  ))}
                </span>
              ) : null}
              <span className="v2-tw-name" lang={o.titleIsUk ? 'uk' : undefined}>{o.title}</span>
              {o.org ? (
                <span className={`v2-tw-org${o.org.kind === 'domain' ? ' is-domain' : ''}`}>
                  <span className="v2-tw-org-mark" aria-hidden="true">{o.org.mark || '↗'}</span>
                  {o.org.text}
                </span>
              ) : null}
              {/* Один рядок замість таблиці фактів: блок стоїть перед списком,
                  і кожні зайві 100px відсувають каталог за екран (Марія,
                  19.10.2026: «дуже багато висоти займає»). */}
              {o.day || o.where ? (
                <span className="v2-tw-line">
                  {o.day ? (
                    <b className={o.daysLeft !== null && o.daysLeft <= 7 ? 'is-urgent' : undefined}>
                      {`${o.day} ${o.month}`}
                      {o.daysLeft !== null && o.daysLeft >= 0 && o.daysLeft <= 7
                        ? ` · ${leftLabel(o.daysLeft, isEn)}` : ''}
                    </b>
                  ) : null}
                  {o.day && o.where ? ' · ' : null}
                  {o.where || null}
                </span>
              ) : null}
              <span className="v2-tw-more" aria-hidden="true">
                {isEn ? 'See details ↗' : 'Детальніше ↗'}
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
