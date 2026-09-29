'use client';
import { Fragment, useMemo, useState } from 'react';
import Link from 'next/link';
import { TYPE_LABELS, TYPE_LABELS_EN, cityLabel } from '@/lib/labels';
import { whenState } from '@/lib/timing';
import { goesAbroad, isOnline } from '@/lib/geo';
import { abroadPlaceText } from '@/lib/place';
import { plural } from '@/lib/plural';
import { inlineCardPositions } from '@/lib/inline-card';
import OpportunityCard from '../OpportunityCard';
import { publicSource } from '@/lib/source-link';
import TelegramCard from '../TelegramCard';
import BotLink from '../plus/BotLink';

/**
 * Картки підбірки за макетом design_handoff_dityam_pidbirka (README, п. 4–5):
 * підфільтри-пігулки з лічильниками, сітка 2 колонки, після 4-ї картки —
 * картка Dityam+ на всю ширину (`plus`, null — не показувати). Сортування робить сервер (найближчий дедлайн
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
    running: 'триває',
    days: (n) => `${n} ${plural(n, 'день', 'дні', 'днів')}`,
    until: (d) => `до ${d}`,
    age: (a, b) => (a === b ? `${a} р.` : `${a}–${b} р.`),
    abroad: 'За кордоном', online: 'Онлайн', allUkraine: 'Вся Україна',
  },
  en: {
    annual: '🔄 every year', open: 'enrolment open', today: 'today', tomorrow: 'tomorrow',
    running: 'on now',
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

/**
 * Текст про час і чи він горить (≤ 7 днів до дедлайну — помаранчевий жирний).
 * Стан — з lib/timing.js, спільного з карткою головної: дедлайн подачі горить
 * завжди, подія показує свою дату, вид важить більше за тип.
 */
function deadlineChip(item, todayIso, lang) {
  const t = TEXT[lang] || TEXT.uk;
  const s = whenState(item, todayIso);
  if (s.state === 'deadline') {
    if (s.days === 0) return { text: `⏰ ${t.today}`, urgent: true };
    if (s.days === 1) return { text: `⏰ ${t.tomorrow}`, urgent: true };
    if (s.days <= 7) return { text: `⏰ ${t.days(s.days)}`, urgent: true };
    if (s.days <= 30) return { text: `⏳ ${t.days(s.days)}`, urgent: false };
    return { text: t.until(dateShort(item.deadline, todayIso, lang)), urgent: false };
  }
  if (s.state === 'event') {
    if (s.days === 1) return { text: `📅 ${t.tomorrow}`, urgent: false };
    return { text: `📅 ${dateShort(s.date, todayIso, lang)}`, urgent: false };
  }
  if (s.state === 'running') return { text: `📅 ${t.running}`, urgent: false };
  if (s.state === 'results') return { text: `🏆 ${dateShort(s.date, todayIso, lang)}`, urgent: false };
  return { text: s.state === 'periodic' ? t.annual : t.open, urgent: false };
}

// abroadLabel — чим підписати закордонний запис без міста. У групі хаба
// діаспори це назва країни з заголовка групи, а не безлике «За кордоном».
function placeText(item, lang, abroadLabel = null) {
  const t = TEXT[lang] || TEXT.uk;
  const real = (item.cities || []).filter((c) => !PSEUDO.has(String(c).toLowerCase().trim()));
  if (goesAbroad(item)) {
    // У групі хаба країна вже в заголовку — лишаємо місто або її назву.
    if (abroadLabel) return real.length ? real.slice(0, 2).map((c) => cityLabel(c, lang)).join(', ') : abroadLabel;
    return abroadPlaceText(item, lang) || t.abroad;
  }
  if (real.length) return real.slice(0, 2).map((c) => cityLabel(c, lang)).join(', ');
  if (isOnline(item)) return t.online;
  if ((item.cities || []).some((c) => /вся україна/i.test(c))) return t.allUkraine;
  return publicSource(item).sourceName || '';
}

export default function TopicCards({
  items, subfilters = [], todayIso, lang = 'uk', pinnedIds = [], pinnedLabel = null,
  labels, hub = null, groups = null, groupLinks = [], abroadLabel = null, plus = null,
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

  // Одна картка на весь сайт (app/OpportunityCard.js). До 28.09.2026 підбірки
  // мали власну .tp-card — тип кольоровим текстом, дедлайн праворуч, місто у
  // футері, — і той самий запис на головній виглядав інакше.
  //
  // `placeFallback` більше не використовується: місто на новій картці не
  // показуємо. Параметр лишено, бо його передають викликачі.
  const card = (item) => (
    <OpportunityCard
      key={item.id}
      item={item}
      lang={lang}
      today={todayIso}
      prefetch={false}
      extraChip={pinned.has(item.id) && pinnedLabel
        ? <span className="chip chip-need">{pinnedLabel}</span>
        : null}
    />
  );

  if (groups) {
    return (
      <GroupedCards
        groups={groups}
        links={groupLinks}
        card={card}
        labels={labels}
        lang={lang}
        hub={hub}
      />
    );
  }

  // Telegram-картка — раз на 20 можливостей, як на головній; картка Dityam+ —
  // після четвертої. Разом вони не стають: канал зʼявляється не раніше
  // десятої картки (inlineCardPositions, min 10).
  const tgAfter = inlineCardPositions(visible.length);

  const cells = [];
  visible.forEach((item, i) => {
    cells.push(card(item, abroadLabel));
    if (i === 3 && plus) {
      cells.push(
        <aside key="plus" className="tp-promo" aria-label="Dityam+">
          <div className="tp-promo-copy">
            <span className="tp-promo-badge">Dityam+</span>
            <h3 className="tp-promo-title">{plus.title}</h3>
            <p className="tp-promo-text">{plus.text}</p>
          </div>
          <BotLink href={plus.href} place={plus.place} className="tp-btn tp-btn-white">
            {plus.cta}
          </BotLink>
        </aside>,
      );
    }
    if (tgAfter.has(i)) cells.push(<TelegramCard key={`tg-card-${i}`} lang={lang} place="topic" hub={hub} />);
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

/**
 * Список групами (хаб «Українським дітям за кордоном»: групи — країни).
 *
 * Угорі — пігулки-зміст: країни з власною сторінкою ведуть туди, решта —
 * на свою групу нижче. Пігулки тут переносяться в рядки, а не гортаються
 * вбік: це зміст сторінки, і схована за краєм країна — це країна, якої
 * людина не побачить. Кожна група — h2 з назвою, картки під нею — h3.
 * Telegram-картка — за тими самими позиціями, що й у пласкому списку
 * (lib/inline-card.js), але після цілої групи, де позиція припала.
 */
function GroupedCards({ groups, links, card, labels, lang, hub }) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  // Ті самі позиції, що в пласкому списку; картка стає після групи, у якій
  // припала позиція, щоб не розривати сітку країни.
  const tgAfter = inlineCardPositions(total);
  const showNav = links.length + groups.length >= 2;
  let seen = 0;

  if (!groups.length && !links.length) {
    return (
      <section className="tp-list" aria-label={labels.listLabel}>
        <div className="tp-empty">
          <span aria-hidden="true">🔍</span>
          <h2>{labels.emptyTitle}</h2>
        </div>
      </section>
    );
  }

  return (
    <section className="tp-list" aria-label={labels.listLabel}>
      <div className="tp-toolbar">
        {showNav ? (
          <nav className="tp-pills tp-group-nav" aria-label={labels.groupNav}>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="tp-pill tp-pill-page">
                {l.label} <span className="tp-pill-n">{l.count}</span> <span aria-hidden="true">→</span>
              </Link>
            ))}
            {groups.map((g) => (
              <a key={g.id} href={`#${g.id}`} className="tp-pill">
                {g.title} <span className="tp-pill-n">{g.items.length}</span>
              </a>
            ))}
          </nav>
        ) : <span />}
        {groups.length ? <span className="tp-sort">{labels.sort}</span> : null}
      </div>

      {links.length && groups.length ? <p className="tp-group-rest">{labels.groupRest}</p> : null}

      {groups.map((g) => {
        const start = seen;
        seen += g.items.length;
        const tgHere = [...tgAfter].some((i) => i >= start && i < seen);
        return (
          <Fragment key={g.id}>
            <section id={g.id} className="tp-group" aria-labelledby={`${g.id}-title`}>
              <h2 id={`${g.id}-title`} className="tp-group-title">
                {g.title} <span className="tp-group-n">{g.items.length}</span>
              </h2>
              <div className="tp-grid">{g.items.map((item) => card(item, g.title))}</div>
            </section>
            {tgHere ? <TelegramCard key={`tg-${g.id}`} lang={lang} place="topic" hub={hub} /> : null}
          </Fragment>
        );
      })}
    </section>
  );
}
