'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { daysUntil } from '@/lib/dates';
import { TYPE_LABELS, TYPE_LABELS_EN, ANNUAL_TYPES, isEvent, cityLabel } from '@/lib/labels';
import { goesAbroad, isOnline } from '@/lib/geo';
import { plural } from '@/lib/plural';

/**
 * Картки підбірки за макетом design_handoff_dityam_pidbirka (README, п. 4–5):
 * підфільтри-пігулки з лічильниками, сітка 2 колонки, після 4-ї картки —
 * промо Dityam+ на всю ширину. Сортування робить сервер (найближчий дедлайн
 * угорі, без дедлайну — вкінці), тут лише фільтр.
 *
 * «Показати ще» прибрано 15.09.2026 на прохання Марії: підбірка показує всі
 * свої можливості одразу, нічого не ховаючи за кнопкою.
 */

// Кольори тегів — рівно ті, що в README макета. Інші типи — колір тексту.
const TAG_FG = {
  camp: '#0a5348', summer_school: '#0a5348',
  club: '#8a5a0a', course: '#8a5a0a', workshop: '#8a5a0a',
  allowance: '#2d5814', support_payment: '#2d5814', medical_aid: '#2d5814', scholarship: '#2d5814',
  exchange: '#4c3d8c', olympiad: '#4c3d8c',
  competition: '#8a1a3a',
};
const TAG_DEFAULT = '#4a4a4a';

const MONTHS = {
  uk: ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const TEXT = {
  uk: {
    annual: '🔄 щорічно', open: 'набір відкритий', today: 'сьогодні', tomorrow: 'завтра',
    days: (n) => `${n} ${plural(n, 'день', 'дні', 'днів')}`,
    until: (d) => `до ${d}`,
    age: (a, b) => (a === b ? `${a} р.` : `${a}–${b} р.`),
    abroad: 'За кордоном', online: 'Онлайн', allUkraine: 'Вся Україна',
  },
  en: {
    annual: '🔄 every year', open: 'enrolment open', today: 'today', tomorrow: 'tomorrow',
    days: (n) => `${n} ${n === 1 ? 'day' : 'days'}`,
    until: (d) => `by ${d}`,
    age: (a, b) => (a === b ? `age ${a}` : `ages ${a}–${b}`),
    abroad: 'Abroad', online: 'Online', allUkraine: 'All of Ukraine',
  },
};

const PSEUDO = new Set(['онлайн', 'вся україна', 'міжнародні', 'україна']);

function dateShort(iso, todayIso, lang) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return iso;
  const day = Number(m[3]);
  const month = (MONTHS[lang] || MONTHS.uk)[Number(m[2]) - 1];
  const year = m[1] === String(todayIso).slice(0, 4) ? '' : ` ${m[1]}`;
  return lang === 'en' ? `${day} ${month}${year}` : `${day} ${month}${year}`;
}

/** Текст дедлайну й чи він горить (≤ 7 днів — помаранчевий жирний). */
function deadlineChip(item, todayIso, lang) {
  const t = TEXT[lang] || TEXT.uk;
  const days = daysUntil(item.deadline, todayIso);
  if (days === null || days < 0) {
    return { text: ANNUAL_TYPES.has(item.opportunity_type) ? t.annual : t.open, urgent: false };
  }
  // Для подій дата — день, коли вона відбувається, а не кінець подачі:
  // «горить» тут було б неправдою.
  if (isEvent(item)) {
    if (days === 0) return { text: `📅 ${t.today}`, urgent: false };
    if (days === 1) return { text: `📅 ${t.tomorrow}`, urgent: false };
    return { text: `📅 ${dateShort(item.deadline, todayIso, lang)}`, urgent: false };
  }
  if (days === 0) return { text: `⏰ ${t.today}`, urgent: true };
  if (days === 1) return { text: `⏰ ${t.tomorrow}`, urgent: true };
  if (days <= 7) return { text: `⏰ ${t.days(days)}`, urgent: true };
  if (days <= 30) return { text: `⏳ ${t.days(days)}`, urgent: false };
  return { text: t.until(dateShort(item.deadline, todayIso, lang)), urgent: false };
}

function placeText(item, lang) {
  const t = TEXT[lang] || TEXT.uk;
  const real = (item.cities || []).filter((c) => !PSEUDO.has(String(c).toLowerCase().trim()));
  if (goesAbroad(item)) return real.length ? real.slice(0, 2).map((c) => cityLabel(c, lang)).join(', ') : t.abroad;
  if (real.length) return real.slice(0, 2).map((c) => cityLabel(c, lang)).join(', ');
  if (isOnline(item)) return t.online;
  if ((item.cities || []).some((c) => /вся україна/i.test(c))) return t.allUkraine;
  return item.source || '';
}

export default function TopicCards({
  items, subfilters = [], todayIso, lang = 'uk', pinnedIds = [], pinnedLabel = null,
  promo = null, labels,
}) {
  const [sub, setSub] = useState('all');
  const isEn = lang === 'en';
  const t = TEXT[lang] || TEXT.uk;
  const pinned = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const filtered = useMemo(() => {
    if (sub === 'all') return items;
    const active = subfilters.find((s) => s.key === sub);
    return active ? items.filter((o) => active.types.includes(o.opportunity_type)) : items;
  }, [items, subfilters, sub]);

  const visible = filtered;

  const choose = (key) => setSub(key);

  const card = (item) => {
    const dl = deadlineChip(item, todayIso, lang);
    const typeLabel = (isEn ? TYPE_LABELS_EN : TYPE_LABELS)[item.opportunity_type] || item.opportunity_type;
    const age = Number.isFinite(item.age_from) && Number.isFinite(item.age_to) ? t.age(item.age_from, item.age_to) : null;
    const title = (isEn && item.title_en) || item.title;
    const summary = (isEn && item.summary_en) || item.summary;
    const href = `${isEn ? '/en' : ''}/o/${item.slug}`;
    return (
      <Link key={item.id} href={href} className="tp-card" prefetch={false}>
        <span className="tp-card-meta">
          <span className="tp-card-meta-l">
            <span className="tp-card-tag" style={{ color: TAG_FG[item.opportunity_type] || TAG_DEFAULT }}>{typeLabel}</span>
            {age ? <><span className="tp-card-sep" aria-hidden="true">·</span><span>{age}</span></> : null}
          </span>
          <span className={`tp-card-dl${dl.urgent ? ' is-urgent' : ''}`}>{dl.text}</span>
        </span>
        {pinned.has(item.id) && pinnedLabel ? <span className="tp-card-pin">{pinnedLabel}</span> : null}
        <h3 className="tp-card-title" lang={isEn && !item.title_en ? 'uk' : undefined}>{title}</h3>
        {summary ? (
          <p className="tp-card-summary" lang={isEn && !item.summary_en ? 'uk' : undefined}>{summary}</p>
        ) : null}
        <span className="tp-card-foot">
          <span className="tp-card-place">{placeText(item, lang)}</span>
          <span className="tp-card-more">{labels.details}</span>
        </span>
      </Link>
    );
  };

  const cells = [];
  visible.forEach((item, i) => {
    cells.push(card(item));
    if (i === 3 && promo) {
      cells.push(
        <aside key="promo" className="tp-promo" aria-label="Dityam+">
          <div className="tp-promo-copy">
            <span className="tp-promo-badge">Dityam+</span>
            <h3 className="tp-promo-title">{promo.title}</h3>
            <p className="tp-promo-text">{promo.text}</p>
          </div>
          <Link href={promo.href} className="tp-btn tp-btn-white">{promo.cta}</Link>
        </aside>,
      );
    }
  });

  return (
    <section className="tp-list" aria-label={labels.listLabel}>
      {/* Невидимий h2: картки — h3, і без h2 над ними ламався порядок заголовків. */}
      <h2 className="sr-only">{labels.listLabel}</h2>
      <div className="tp-toolbar">
        {subfilters.length >= 2 ? (
          <div className="tp-pills" role="group" aria-label={labels.filterLabel}>
            {[{ key: 'all', label: labels.all, count: items.length }, ...subfilters].map((s) => (
              <button
                key={s.key}
                type="button"
                className={`tp-pill${sub === s.key ? ' is-on' : ''}`}
                aria-pressed={sub === s.key}
                onClick={() => choose(s.key)}
              >
                {s.label} <span className="tp-pill-n">{s.count}</span>
              </button>
            ))}
          </div>
        ) : <span />}
        <span className="tp-sort">{labels.sort}</span>
      </div>

      {visible.length ? (
        <div className="tp-grid">{cells}</div>
      ) : (
        <div className="tp-empty">
          <span aria-hidden="true">🔍</span>
          <h3>{labels.emptyTitle}</h3>
          <p>{labels.emptyText}</p>
        </div>
      )}
    </section>
  );
}
