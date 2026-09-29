import Link from 'next/link';
import { daysUntil } from '@/lib/dates';
import {
  TYPE_LABELS, TYPE_LABELS_EN, NEED_LABELS, NEED_LABELS_EN, ageRangeLabel,
} from '@/lib/labels';
import { cardFacts, CARD_LABELS } from '@/lib/card-facts';

/**
 * Картка можливості — одна на весь сайт.
 *
 * До 28.09.2026 та сама картка була зверстана ТРИЧІ, кожного разу по-своєму:
 *   .v2-card / .m-card — каталог на головній і в містах;
 *   .tp-card           — підбірки (/konkursy, /olimpiady…);
 *   .card + .chips     — «Схожі можливості» на сторінці можливості.
 * Людина, що йшла з головної на сторінку можливості, бачила той самий запис
 * у двох різних виглядах. Марія обрала третій: «отака всюди».
 *
 * З 29.09.2026 картка має два вигляди для A/B-тесту (lib/ab-card.js):
 *   A — як була: пігулки (тип, вік, вартість, дедлайн, обставини), назва,
 *       опис до пʼяти рядків, поля й футер «формат · місце»;
 *   B — за макетом «Dityam — редизайн каталогу»: вік першим, потім тип;
 *       вартості й дедлайну серед пігулок немає — вони в блоці деталей
 *       (.meta: дедлайн, вартість, формат, організатор); опис у два рядки;
 *       на телефоні рядок «формат · вартість» і внизу «До {дата} · {n днів}»
 *       поруч із «Детальніше».
 * Розмітка одна на обидва варіанти, різницю робить CSS (cards.css) за
 * атрибутом data-ab-card на <html>: HTML однаковий для всіх і лишається в
 * кеші ISR. Класи chip-cost і chip-when позначають те, що B ховає;
 * .meta, .card-b-line і .card-b-foot — те, що бачить лише B.
 *
 * Компонент серверний: жодного стану, лише дані й посилання. Класи й кольори
 * — app/styles/cards.css, і вони вже глобальні.
 */

const T = {
  uk: { free: 'безкоштовно', paid: 'платно', askSchool: 'вартість уточнюйте в школі', today: 'сьогодні', days: (n) => `${n} днів` },
  en: { free: 'free', paid: 'paid', askSchool: 'ask the school about the price', today: 'today', days: (n) => `${n} days` },
};

/** Англійське поле з бази, з відкатом на оригінал: переклад доїжджає партіями. */
const field = (item, name, lang) =>
  (lang === 'en' && item[`${name}_en`]) || item[name] || '';

/**
 * `fields` — пари [підпис, значення] під описом: у каталозі це «Формат»,
 * «Місце», «Джерело», а в підлітковому режимі — «що отримаєш» і «що треба».
 * Їх немає на картці «схожих можливостей», але викидати разом із виглядом їх
 * не можна: у режимі «Підліткам» це єдине, заради чого картку читають.
 *
 * `footer` — рядок під полями (місто й формат одним рядком). Лише варіант A:
 * у B те саме стоїть у блоці деталей.
 * `moreLabel` — «Детальніше →» варіанта A. Саме текстом, а не посиланням: уся
 * картка вже одне посилання, і вкладений <a> був би нечинною розміткою.
 * У варіанті B підпис «Детальніше ↗» є на кожній картці (рішення 29.09.2026).
 */
export default function OpportunityCard({
  item, lang = 'uk', today, href, prefetch, extraChip = null,
  fields = null, footer = null, moreLabel = null,
}) {
  const t = T[lang] || T.uk;
  const b = CARD_LABELS[lang] || CARD_LABELS.uk;
  const types = lang === 'en' ? TYPE_LABELS_EN : TYPE_LABELS;
  const needs = lang === 'en' ? NEED_LABELS_EN : NEED_LABELS;

  const days = daysUntil(item.deadline, today);
  const own = (item.child_needs || []).filter((n) => needs[n]);
  const summary = field(item, 'summary', lang);
  const title = field(item, 'title', lang);
  const url = href || `${lang === 'en' ? '/en' : ''}/o/${item.slug}`;
  const paid = item.cost_type === 'paid_affordable' || item.cost_type === 'paid_premium';
  // Порожні поля відсіюємо ДО перевірки: інакше в розмітку йшов порожній <dl>
  // з відступом, і під описом зʼявлялась дірка на картках без формату й джерела.
  const rows = (fields || []).filter(([, v]) => v);

  // Варіант B: факти з запису (lib/card-facts.js). Порожнє — рядка немає.
  const facts = cardFacts(item, today, lang);
  const meta = [
    facts.when ? [facts.when.label, facts.when.kind === 'urgent'
      ? <span className="chip chip-deadline-urgent">{facts.when.text}</span>
      : facts.when.text] : null,
    facts.cost ? [b.cost, facts.cost] : null,
    facts.format ? [b.format, facts.format] : null,
    facts.organiser ? [b.organiser, facts.organiser] : null,
  ].filter(Boolean);
  const bLine = [facts.format, facts.cost].filter(Boolean).join(' · ');

  return (
    <Link
      href={url}
      className="card"
      style={{ textDecoration: 'none' }}
      {...(prefetch === false ? { prefetch: false } : {})}
    >
      <div className="chips">
        <span className="chip chip-type">{types[item.opportunity_type] || item.opportunity_type}</span>
        <span className="chip chip-age">{ageRangeLabel(item, lang)}</span>
        {item.cost_type === 'free' ? <span className="chip chip-free chip-cost">{t.free}</span> : null}
        {paid ? <span className="chip chip-paid chip-cost">{t.paid}</span> : null}
        {/* Школа чи студія діаспори без ціни на сторінці (28.09.2026): не
            «безкоштовно» і не «платно», а чесно — ціну знає школа. */}
        {item.cost_type === 'ask_school' ? <span className="chip chip-cost-ask chip-cost">{t.askSchool}</span> : null}
        {days !== null && days >= 0 && days <= 7 ? (
          <span className="chip chip-deadline-urgent chip-when">
            ⏰ {days === 0 ? t.today : t.days(days)}
          </span>
        ) : null}
        {days !== null && days > 7 && days <= 30 ? (
          <span className="chip chip-deadline-soon chip-when">⏳ {t.days(days)}</span>
        ) : null}
        {/* Дві обставини — стеля: далі рядок пігулок переноситься й картка
            перестає читатись за секунду, заради якої вона й потрібна. */}
        {own.slice(0, 2).map((n) => (
          <span key={n} className="chip chip-need">{needs[n]}</span>
        ))}
        {extraChip}
      </div>
      <h3
        className="card-title-link"
        lang={lang === 'en' && !item.title_en ? 'uk' : undefined}
        style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.35, color: 'var(--ink)' }}
      >
        {title}
      </h3>
      {summary ? (
        <p className="card-summary" lang={lang === 'en' && !item.summary_en ? 'uk' : undefined}>
          {summary.length > 140 ? `${summary.slice(0, 140)}…` : summary}
        </p>
      ) : null}
      {/* B, телефон: «Онлайн · Безкоштовно» одним рядком під назвою. */}
      {bLine ? <p className="card-b-line">{bLine}</p> : null}
      {/* B, десктоп: блок деталей. Підпис ліворуч, значення праворуч. */}
      {meta.length ? (
        <dl className="meta">
          {meta.map(([k, v]) => (
            <div key={k} className="meta-row">
              <dt className="meta-label">{k}</dt>
              <dd className="meta-val">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {rows.length ? (
        <dl className="card-fields">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {footer ? <div className="card-foot">{footer}</div> : null}
      {moreLabel ? <span className="card-more card-a">{moreLabel}</span> : null}
      {/* B: «Детальніше ↗» завжди; на телефоні поруч із ним дедлайн. */}
      <div className="card-b-foot">
        {facts.when ? (
          <span className={`card-b-when${facts.when.kind === 'urgent' ? ' is-urgent' : ''}`}>
            {facts.when.foot}
          </span>
        ) : <span />}
        <span className="card-more card-b">{b.details}</span>
      </div>
    </Link>
  );
}
