'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readMode, onModeChange } from '@/lib/mode';
import { trackConversion } from '@/lib/track';
import { TYPE_LABELS, TYPE_LABELS_EN, ageRangeLabel } from '@/lib/labels';
import HomeTopics from './HomeTopics';
import TopWeekSlider from './TopWeekSlider';
import { sliderCards } from '@/lib/top-week-slider';
import { SIA_AWARD, ringLayout } from '@/lib/awards';
import useSearchSuggest from './useSearchSuggest';

// Хіро головної (редизайн 29.09.2026, макет Main.dc.html): надпис, заголовок,
// опис, пошук із кнопкою «Знайти», шість плиток тем із фото, рядок довіри;
// праворуч — «Встигніть цього тижня» з трьома найближчими дедлайнами (та
// сама трійка «Топ тижня», що й раніше, тепер рахується на сервері в
// app/page.js) і посилання на всі дедлайни.
//
// Фото й великі цифри з хіро знято (рішення Марії 29.09.2026 за макетом;
// 15.09 їх повертали). Рядка довіри «{N} можливостей · оновлюється щодня»
// теж немає (Марія, 30.09.2026: «навіщо це 2 рази»): число стоїть над
// списком і змінюється з фільтрами, а «оновлюється щодня» уже є в надписі
// над заголовком.
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
    // Панель — «Топ 3 цього тижня» (Марія, 30.09.2026): закріплені «Топ»
    // і найближчі дедлайни разом, а не «найближчі дедлайни» як такі.
    // Посилання «Усі дедлайни →» під рейтингом прибрано (Марія, 07.10.2026:
    // «видали усі дедлайни, щоб рівно було») — низ панелі стає врівень із
    // пошуком. У підбірках воно лишається.
    soonTitle: 'Топ 3 цього тижня',
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
    soonTitle: 'Top 3 this week',
    pinned: 'Top',
    free: 'free',
  },
};

export default function HomeHero({ soon = [], teenSoon = [], today = null, lang = 'uk' }) {
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


  const items = (mode === 'teens' ? teenSoon : soon) || [];

  const runSearch = (raw) => {
    const value = raw.trim();
    window.dispatchEvent(new CustomEvent(HERO_SEARCH_EVENT, { detail: { q: value } }));
    const target = document.getElementById('catalog');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const submit = (e) => {
    e.preventDefault();
    runSearch(q);
  };
  // Підказки під полем (app/useSearchSuggest.js): обране слово одразу шукає.
  const { inputProps: suggestProps, popup: suggestPopup } = useSearchSuggest({
    id: 'hero-search',
    value: q,
    onPickWord: (text) => { setQ(text); runSearch(text); },
    lang,
  });

  const leadCut = c.lead.lastIndexOf(' ') + 1;
  const leadHead = c.lead.slice(0, leadCut);
  const leadLast = c.lead.slice(leadCut);

  // Наліпка нагороди (див. коментар біля якорів у заголовку).
  const siaSeal = (
    <a
      href={SIA_AWARD.href}
      target="_blank"
      rel="noopener noreferrer"
      className="v2-sia-seal"
      aria-label={SIA_AWARD.full[isEn ? 'en' : 'uk']}
      title={SIA_AWARD.full[isEn ? 'en' : 'uk']}
      onClick={() => {
        if (window.gtag) window.gtag('event', 'header_nav_click', { event_label: 'sia_award_hero' });
      }}
    >
      <span className="v2-sia-ring" aria-hidden="true">
        {ringLayout(SIA_AWARD.ring[isEn ? 'en' : 'uk']).map(({ ch, deg }, i) => (
          <span key={i} style={{ transform: `rotate(${deg}deg)` }}>{ch}</span>
        ))}
      </span>
    </a>
  );

  return (
    <section className="v2-hero-band">
      <div className="v2-hero">
        <div className="v2-hero-copy">
          <div className="v2-hero-status">
            <span className="v2-dot" aria-hidden="true" />
            {t.live}
          </div>
          <h1>
            {/* Останнє слово першого рядка склеєне з якорем наліпки: перед
                inline-block браузер має право перенести рядок, і з text-wrap:
                balance коло опинялось на початку другого рядка, а не після
                «можливості». */}
            {leadHead}<span className="v2-sia-glue">{leadLast}<span className="v2-sia-anchor v2-sia-anchor--lead">{siaSeal}</span></span> <br className="v2-hero-br" /><span className="v2-script">{c.script}</span><span className="v2-hero-tail">{c.tail}</span>
            {/* Наліпка нагороди на кінці головної фрази (Марія, 07.10.2026: «наклади
                цей кружечок прямо на кінець головної фрази»). Помаранчеве коло з
                білим текстом, що повільно обертається; центр порожній («не треба
                кубок»). Літери стоять по колу кожна своїм поворотом, а не через
                SVG textPath: iOS Safari не тримає letter-spacing у SVG-тексті, і
                коло там «не відмальовувалось нормально». Адреса — lib/awards.js. */}
            <span className="v2-sia-anchor v2-sia-anchor--end">{siaSeal}</span>
          </h1>
          <p className="v2-hero-sub">{c.sub}</p>
          {/* SIA на телефоні — печатка «SIA 2026» і рукописний підпис (Марія,
              09.10.2026, обрала з 3 варіантів: «оце можна, тільки без сірого
              маленького тексту внизу»). Кільця в заголовку на телефоні немає
              (08.10.2026), на компʼютері ця печатка схована — там кільце. */}
          <a
            href={SIA_AWARD.href}
            target="_blank"
            rel="noopener noreferrer"
            className="v2-sia-medal"
            aria-label={SIA_AWARD.full[isEn ? 'en' : 'uk']}
            onClick={() => {
              if (window.gtag) window.gtag('event', 'header_nav_click', { event_label: 'sia_award_hero_mobile' });
            }}
          >
            <span className="v2-sia-medal-disc" aria-hidden="true">SIA<b>2026</b></span>
            <span className="v2-sia-medal-text">{isEn ? 'SIA Ukraine winner' : 'Переможець SIA Ukraine'}</span>
          </a>

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
                {...suggestProps}
              />
              {suggestPopup}
            </label>
            <button type="submit" className="v2-hero-search-btn">{t.search}</button>
          </form>

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
          <TopWeekSlider
            lang={lang}
            title={t.soonTitle}
            cards={sliderCards(items, {
              lang,
              pinned: t.pinned,
              free: t.free,
              type: TYPES,
              age: (o) => ageRangeLabel(o, lang),
            })}
          />
        ) : null}

        {/* Плитки тем — окремим рядком на всю ширину hero, під обома колонками
            (Марія, 30.09.2026). На телефоні — та сама шістка, але із
            заголовком «Або оберіть тему», але стоїть він не тут, а в списку
            одразу під віковими пігулками (app/page.js, prop afterAges).

            До 05.10.2026 мобільний варіант був у кінці сторінки, на ~17 300px:
            побачити його не міг майже ніхто. */}
        <HomeTopics lang={lang} variant="hero" />
      </div>
    </section>
  );
}
