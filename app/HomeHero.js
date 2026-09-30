'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readMode, onModeChange } from '@/lib/mode';
import { opportunitiesWord } from '@/lib/plural';
import { trackConversion } from '@/lib/track';
import { TYPE_LABELS, TYPE_LABELS_EN, ageRangeLabel } from '@/lib/labels';
import HomeTopics from './HomeTopics';

// Хіро головної (редизайн 29.09.2026, макет Main.dc.html): надпис, заголовок,
// опис, пошук із кнопкою «Знайти», шість плиток тем із фото, рядок довіри;
// праворуч — «Встигніть цього тижня» з трьома найближчими дедлайнами (та
// сама трійка «Топ тижня», що й раніше, тепер рахується на сервері в
// app/page.js) і посилання на всі дедлайни.
//
// Фото й великі цифри з хіро знято (рішення Марії 29.09.2026 за макетом;
// 15.09 їх повертали). Рядок довіри — «{N} можливостей · оновлюється щодня»:
// мʼякше за формулювання з макета, бо для старих записів перевірка — це лише
// щоденний пінг посилання.
//
// Копія залежить від режиму «Батькам / Підліткам», тому компонент
// клієнтський. SSR завжди віддає батьківську версію — саме її бачить Google.
// У режимі «Підліткам» хіро — чорна смуга (напрям A, вибір Марії 10.09.2026):
// режим вивішується атрибутом data-mode на <html>.
//
// Пошук у хіро не має власного списку: він шле подію dityam:search, яку
// слухає каталог нижче (app/OpportunitiesList.js), і прокручує до нього.
export const HERO_SEARCH_EVENT = 'dityam:search';

// «Перевірені програми, зібрані вручну» прибрано 13.09.2026 на прохання Марії.
// Це було неправдою: записи збирають скрапери й агент-розвідник, а не люди.
// Не повертати.
const COPY = {
  uk: {
    parents: {
      lead: 'Усі можливості',
      script: 'для вашої дитини',
      tail: ' в одному місці',
      // Перелік іде за тим, ЧОГО В БАЗІ БІЛЬШЕ (звірено 28.09.2026).
      sub: 'Гуртки, курси, конкурси, олімпіади, табори, стипендії, обміни, '
        + 'волонтерство, виплати й медична допомога — для дітей 0–18 років.',
    },
    teens: {
      lead: 'Можливості',
      script: 'для тебе',
      tail: ' — обміни, стажування, стипендії',
      sub: 'Усе, на що можна податись самостійно у 13–18: обміни за кордон, '
        + 'стажування, стипендії, волонтерство, підготовка до НМТ. Перевірено, '
        + 'більшість безкоштовно.',
      link: true,
      linkText: 'Їдеш за кордон? Усі обміни, стипендії й табори',
      linkHref: '/za-kordon',
    },
    live: 'Безкоштовно і оновлюється щодня',
    searchPlaceholder: 'Олімпіада з математики, табір у Львові, робототехніка…',
    search: 'Знайти',
    searchAria: 'Пошук можливостей',
    trust: 'оновлюється щодня',
    soonTitle: 'Встигніть цього тижня',
    soonTitleLater: 'Найближчі дедлайни',
    allDeadlines: 'Усі дедлайни →',
    allDeadlinesHref: '/dedlainy',
    pinned: 'Топ',
    free: 'безкоштовно',
  },
  en: {
    parents: {
      lead: 'Every opportunity',
      script: 'for your child',
      tail: ' in one place',
      sub: 'Courses, olympiads, scholarships, camps, medical aid and payments '
        + 'for children aged 0–18 in Ukraine and abroad.',
    },
    teens: {
      lead: 'Opportunities',
      script: 'for you',
      tail: ' — exchanges, internships, scholarships',
      sub: 'Everything you can apply to on your own at 13–18: exchanges abroad, '
        + 'internships, scholarships, volunteering. Verified, mostly free.',
      link: true,
      linkText: 'Going abroad? All exchanges, scholarships and camps',
      linkHref: '/en/abroad',
    },
    live: 'Free and updated daily',
    searchPlaceholder: 'Maths olympiad, camp in Lviv, robotics…',
    search: 'Search',
    searchAria: 'Search opportunities',
    trust: 'updated daily',
    soonTitle: 'Closing this week',
    soonTitleLater: 'Closing soonest',
    allDeadlines: null,
    allDeadlinesHref: null,
    pinned: 'Top',
    free: 'free',
  },
};

const MONTHS = {
  uk: ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв', 'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const dateParts = (iso, lang) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  return { day: Number(m[3]), month: (MONTHS[lang] || MONTHS.uk)[Number(m[2]) - 1] };
};

const daysBetween = (iso, todayIso) => {
  const d = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : null; };
  const a = d(iso); const b = d(todayIso);
  return a === null || b === null ? null : Math.floor(a - b);
};

export default function HomeHero({
  stats: parentStats, teenStats, soon = [], teenSoon = [], today = null, lang = 'uk',
}) {
  const [mode, setMode] = useState('parents');
  const [q, setQ] = useState('');
  useEffect(() => {
    const apply = (m) => {
      setMode(m);
      document.documentElement.dataset.mode = m;
    };
    apply(readMode());
    const off = onModeChange(apply);
    // Прийшли за посиланням ?q=… — поле показує той самий запит, що й список.
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('q');
      if (fromUrl) setQ(fromUrl);
    } catch { /* без адреси лишається порожнє поле */ }
    return () => {
      off();
      delete document.documentElement.dataset.mode;
    };
  }, []);

  const t = COPY[lang] || COPY.uk;
  const c = t[mode];
  const isEn = lang === 'en';
  const TYPES = isEn ? TYPE_LABELS_EN : TYPE_LABELS;

  const n = (mode === 'teens' ? teenStats : parentStats) || parentStats || {};
  const total = Number(n.total);
  const trust = Number.isFinite(total) && total > 0
    ? `${total} ${isEn ? 'opportunities' : opportunitiesWord(total)} · ${t.trust}`
    : null;

  const items = (mode === 'teens' ? teenSoon : soon) || [];
  const allWithinWeek = items.length > 0 && items.every((o) => {
    const d = daysBetween(o.deadline, today);
    return d !== null && d >= 0 && d <= 7;
  });

  const submit = (e) => {
    e.preventDefault();
    const value = q.trim();
    window.dispatchEvent(new CustomEvent(HERO_SEARCH_EVENT, { detail: { q: value } }));
    const target = document.getElementById('catalog');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="v2-hero-band">
      <div className="v2-hero">
        <div className="v2-hero-copy">
          <div className="v2-hero-status">
            <span className="v2-dot" aria-hidden="true" />
            {t.live}
          </div>
          <h1>
            {c.lead} <span className="v2-script">{c.script}</span><span className="v2-hero-tail">{c.tail}</span>
          </h1>
          <p className="v2-hero-sub">{c.sub}</p>

          <form className="v2-hero-search" role="search" onSubmit={submit}>
            <label className="v2-hero-search-field">
              <span aria-hidden="true">🔍</span>
              <input
                type="search"
                enterKeyHint="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchAria}
              />
            </label>
            <button type="submit" className="v2-hero-search-btn">{t.search}</button>
          </form>

          <HomeTopics lang={lang} variant="hero" />

          {trust ? <p className="v2-trust">{trust}</p> : null}

          {/* Підбірка «За кордон» — окремий блок, а не рядок у тексті: це
              найсильніший запит підлітків, і як посилання серед абзаців його
              не помічали. Клік шлемо в аналітику окремою подією, щоб бачити
              конверсію хіро → підбірка (GA4: teen_abroad_click). */}
          {c.link ? (
            <Link
              href={c.linkHref}
              className="v2-hero-cta"
              onClick={() => trackConversion('teen_abroad_click', {
                event_label: c.linkHref,
                event_source: 'hero_teens',
              })}
            >
              <span>{c.linkText}</span>
              <span className="v2-hero-cta-arrow" aria-hidden="true">→</span>
            </Link>
          ) : null}
        </div>

        {/* «Встигніть цього тижня»: та сама трійка, що раніше стояла блоком
            «Топ тижня» над стрічкою (відмічені в адмінці + найближчі
            дедлайни, lib/weekly-top.js). Заголовок обіцяє «цього тижня» лише
            коли всі три справді закриваються за 7 днів. */}
        {items.length === 3 ? (
          <aside className="v2-soon" aria-labelledby="v2-soon-title">
            <span id="v2-soon-title" className="v2-soon-title">
              {allWithinWeek ? t.soonTitle : t.soonTitleLater}
            </span>
            {items.map((o) => {
              const d = dateParts(o.deadline, lang);
              const meta = [
                TYPES[o.opportunity_type] || null,
                ageRangeLabel(o, lang),
                o.cost_type === 'free' ? t.free : null,
              ].filter(Boolean).join(' · ');
              return (
                <Link key={o.slug} href={`${isEn ? '/en' : ''}/o/${o.slug}`} className="v2-soon-item">
                  <span className="v2-soon-date" aria-hidden="true">
                    {d ? (
                      <>
                        <span className="v2-soon-day">{d.day}</span>
                        <span className="v2-soon-month">{d.month}</span>
                      </>
                    ) : <span className="v2-soon-month">{t.pinned}</span>}
                  </span>
                  <span className="v2-soon-text">
                    <span className="v2-soon-name">{(isEn && o.title_en) || o.title}</span>
                    <span className="v2-soon-meta">{meta}</span>
                  </span>
                </Link>
              );
            })}
            {t.allDeadlines ? (
              <Link href={t.allDeadlinesHref} className="v2-soon-all">{t.allDeadlines}</Link>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
