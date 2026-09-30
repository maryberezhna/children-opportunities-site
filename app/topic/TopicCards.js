'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { inlineCardPositions } from '@/lib/inline-card';
import { AGE_GROUPS, applyTopicFilters } from '@/lib/topic-filters';
import { trackFilterApply, filterSignature } from '@/lib/track';
import OpportunityCard from '../OpportunityCard';
import TelegramCard from '../TelegramCard';

/**
 * Картки підбірки (редизайн 29.09.2026, макет Topic.dc.html / TopicMobile).
 *
 * Один рядок фільтрів над списком: вкладки типів із лічильниками, вік (ті
 * самі пʼять груп, що на головній), «Лише безкоштовні», «Онлайн», підпис
 * сортування. Сортування робить сервер (найближчий дедлайн угорі, без
 * дедлайну — вкінці), тут лише фільтр. Лічильники рахуються з урахуванням
 * решти фільтрів; порожні варіанти не показуються.
 *
 * Список — дві колонки, картка каналу після першого ряду й далі раз на
 * двадцять (lib/inline-card.js). Усі картки є в HTML для пошуку й
 * внутрішніх посилань, але видно перші 20; далі — кнопка «Завантажити ще»
 * і рядок «Показано X з N». Автопродовження, яке стояло тут із 29.09.2026,
 * Марія зняла 30.09: у підбірці на 70 карток людина ніколи не догортала
 * до «Інших підбірок» і блоку для організаторів — список сам ріс під
 * пальцем. Кнопка лишає кінець сторінки досяжним.
 *
 * Картки Dityam+ тут більше немає (рішення Марії 29.09.2026; повернута
 * 28.09 у #532 — скасовано): у підбірці веде лише канал.
 */

const PAGE = 20;

const DEFAULT_LABELS = {
  uk: {
    all: 'Усі', sort: 'за дедлайном, найближчі спочатку', details: 'Детальніше →',
    emptyTitle: 'Нічого не знайдено', emptyText: 'Спробуйте інший фільтр.',
    listLabel: 'Можливості підбірки', filterLabel: 'Фільтр за типом',
    groupNav: 'Країни', groupRest: 'Інші країни',
    age: 'Вік дитини', ageLabel: 'Вік дитини', onlyFree: 'Лише безкоштовні', online: 'Онлайн',
    reset: 'Скинути', shown: (x, n) => `Показано ${x} з ${n}`, more: 'Завантажити ще',
  },
  en: {
    all: 'All', sort: 'by deadline, soonest first', details: 'Details →',
    emptyTitle: 'Nothing found', emptyText: 'Try a different filter.',
    listLabel: 'Opportunities in this collection', filterLabel: 'Filter by type',
    groupNav: 'Countries', groupRest: 'Other countries',
    age: 'Child age', ageLabel: 'Child age', onlyFree: 'Free only', online: 'Online',
    reset: 'Reset', shown: (x, n) => `Showing ${x} of ${n}`, more: 'Load more',
  },
};

export default function TopicCards({
  items, subfilters = [], todayIso, lang = 'uk', pinnedIds = [], pinnedLabel = null,
  labels, hub = null, groups = null, groupLinks = [], abroadLabel = null,
}) {
  // Сторінки /olimpiady й /erasmus передають власні підписи без нових ключів.
  const t = { ...(DEFAULT_LABELS[lang] || DEFAULT_LABELS.uk), ...(labels || {}) };
  const pinned = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const [sub, setSub] = useState('all');
  const [age, setAge] = useState(null);
  const [free, setFree] = useState(false);
  const [online, setOnline] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const typesOf = (key) => (key === 'all' ? null : (subfilters.find((s) => s.key === key)?.types || null));

  const filtered = useMemo(
    () => applyTopicFilters(items, { types: typesOf(sub), age, free, online }),
    [items, subfilters, sub, age, free, online],
  );

  // Лічильники з урахуванням решти фільтрів: вкладка каже, скільки буде,
  // якщо її натиснути зараз, а не скільки записів такого типу взагалі.
  const countTab = (key) => applyTopicFilters(items, { types: typesOf(key), age, free, online }).length;
  const countAge = (v) => applyTopicFilters(items, { types: typesOf(sub), age: v, free, online }).length;
  const freeCount = applyTopicFilters(items, { types: typesOf(sub), age, free: true, online }).length;
  const onlineCount = applyTopicFilters(items, { types: typesOf(sub), age, free, online: true }).length;
  const ages = AGE_GROUPS.filter(([v]) => countAge(v) > 0 || age === v);
  const hasActive = sub !== 'all' || age !== null || free || online;

  // Зміна фільтра — спочатку списку і подія filter_apply (воронка #570).
  const signature = filterSignature({
    type: sub === 'all' ? [] : [sub], age: age ? [age] : [],
    cost: free ? 'free' : 'all', place: online ? ['online'] : [],
  });
  const lastSig = useRef('');
  useEffect(() => {
    setShown(PAGE);
    if (signature !== lastSig.current) {
      lastSig.current = signature;
      trackFilterApply(signature, filtered.length);
    }
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore = shown < filtered.length;

  const reset = () => { setSub('all'); setAge(null); setFree(false); setOnline(false); };

  // Одна картка на весь сайт (app/OpportunityCard.js).
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
      <GroupedCards groups={groups} links={groupLinks} card={card} labels={t} lang={lang} hub={hub} />
    );
  }

  // Канал після першого ряду (дві картки) і далі раз на двадцять.
  const tgAfter = new Set(inlineCardPositions(filtered.length));
  if (filtered.length > 2) tgAfter.add(1);

  const cells = [];
  filtered.forEach((item, i) => {
    cells.push(
      <div key={item.id} className={`tp-cell${i >= shown ? ' is-hidden' : ''}`}>
        {card(item, abroadLabel)}
      </div>,
    );
    if (tgAfter.has(i) && i < shown) {
      cells.push(<TelegramCard key={`tg-card-${i}`} lang={lang} place="topic" hub={hub} />);
    }
  });

  return (
    <section className="tp-list" aria-label={t.listLabel}>
      {/* Невидимий h2: картки — h3, і без h2 над ними ламався порядок заголовків. */}
      <h2 className="sr-only">{t.listLabel}</h2>

      <div className="tp-filters">
        {subfilters.length >= 2 ? (
          <div className="tp-pills" role="group" aria-label={t.filterLabel}>
            {[{ key: 'all', label: t.all }, ...subfilters].map((s) => {
              const n = countTab(s.key);
              if (s.key !== 'all' && n === 0 && sub !== s.key) return null;
              return (
                <button
                  key={s.key}
                  type="button"
                  className={`tp-pill${sub === s.key ? ' is-on' : ''}`}
                  aria-pressed={sub === s.key}
                  onClick={() => setSub(s.key)}
                >
                  {s.label} <span className="tp-pill-n">{n}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {ages.length >= 2 ? (
          <div className="tp-ages" role="group" aria-label={t.ageLabel}>
            <span className="tp-filter-label">{t.age}</span>
            {ages.map(([v, label, labelEn]) => (
              <button
                key={v}
                type="button"
                className={`tp-pill tp-pill-age${age === v ? ' is-on' : ''}`}
                aria-pressed={age === v}
                onClick={() => setAge(age === v ? null : v)}
              >
                {lang === 'en' ? labelEn : label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Перемикач має сенс, лише коли він щось відсіює: у підбірці, де все
            безкоштовне, «Лише безкоштовні» нічого не змінює й лише плутає. */}
        {free || (freeCount > 0 && freeCount < filtered.length) ? (
          <label className="tp-check">
            <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} />
            {t.onlyFree}
          </label>
        ) : null}
        {online || (onlineCount > 0 && onlineCount < filtered.length) ? (
          <label className="tp-check">
            <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />
            {t.online}
          </label>
        ) : null}

        {hasActive ? (
          <button type="button" className="tp-reset" onClick={reset}>{t.reset}</button>
        ) : null}
        <span className="tp-sort">{t.sort}</span>
      </div>

      {filtered.length ? (
        <>
          <div className="tp-grid">{cells}</div>
          <div className="tp-more" aria-live="polite">
            <span className="tp-more-count">{t.shown(Math.min(shown, filtered.length), filtered.length)}</span>
            {hasMore ? (
              <button type="button" className="tp-btn tp-btn-outline" onClick={() => setShown((s) => s + PAGE)}>
                {t.more}
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="tp-empty">
          <span aria-hidden="true">🔍</span>
          <h3>{t.emptyTitle}</h3>
          <p>{t.emptyText}</p>
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
