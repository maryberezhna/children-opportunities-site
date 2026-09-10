'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PressLogos from './PressLogos';
import { readMode, onModeChange } from '@/lib/mode';
import { opportunitiesWord, sourcesWord, freeWord } from '@/lib/plural';

// Хіро головної: копія залежить від режиму «Батькам / Підліткам», тому
// компонент клієнтський. SSR завжди віддає батьківську версію — саме її
// бачить Google, і саме вона лишається дефолтом для нових відвідувачів.
//
// Хіро живе ПОЗА .v2-container: у режимі «Підліткам» це чорна смуга на всю
// ширину (напрям A з канвасу «Dityam.com.ua для підлітків», вибір Марії
// 10.09.2026). Режим вивішується атрибутом data-mode на <html>, і решта
// сторінки (чипи, дедлайни, «Топ тижня») темніє через CSS, без пропсів.
//
// Текст ліворуч, фото праворуч, під текстом — статистика великими цифрами.
// Фото теж залежить від режиму: батькам — діти на майданчику, підліткам —
// пʼятеро підлітків (Tim Mossholder, Unsplash, hOF1bWoet_Q; ліцензія Unsplash
// дозволяє використання без вказання автора). Малюки в хіро сторінки для
// 13–18-річних читались як «це не про мене» — зауваження Марії, 6.09.2026.
// Референс редизайну пропонував хіро без фото й тихий рядок «N можливостей ·
// N безкоштовно»; Марія повернула обидва елементи з попередньої головної:
// фото робить сторінку живою, а «1119 можливостей» великим кеглем — це
// головний аргумент лишитися.

const COPY = {
  uk: {
    parents: {
      lead: 'Усі можливості',
      script: 'для вашої дитини',
      tail: ' в одному місці',
      sub: 'Курси, олімпіади, стипендії, табори, медична допомога та виплати '
        + 'для дітей 0–18 років в Україні та за кордоном. Перевірені програми, '
        + 'зібрані вручну.',
      age: '0–18',
      photoAlt: 'Усміхнені діти на дитячому майданчику',
    },
    teens: {
      lead: 'Можливості',
      script: 'для тебе',
      tail: ' — обміни, стажування, стипендії',
      sub: 'Усе, на що можна податись самостійно у 13–18: обміни за кордон, '
        + 'стажування, стипендії, волонтерство, підготовка до НМТ. Перевірено, '
        + 'більшість безкоштовно.',
      age: '13–18',
      photoAlt: 'Пʼятеро усміхнених підлітків надворі',
      link: 'Їдеш за кордон? Усі обміни, стипендії й табори →',
      linkHref: '/za-kordon',
    },
    live: 'Безкоштовно і оновлюється щодня',
    press: 'Про нас пишуть:',
    years: 'років',
  },
  en: {
    parents: {
      lead: 'Every opportunity',
      script: 'for your child',
      tail: ' in one place',
      sub: 'Courses, olympiads, scholarships, camps, medical aid and payments '
        + 'for children aged 0–18 in Ukraine and abroad. Verified programs, '
        + 'curated by hand.',
      age: '0–18',
      photoAlt: 'Smiling children on a playground',
    },
    teens: {
      lead: 'Opportunities',
      script: 'for you',
      tail: ' — exchanges, internships, scholarships',
      sub: 'Everything you can apply to on your own at 13–18: exchanges abroad, '
        + 'internships, scholarships, volunteering. Verified, mostly free.',
      age: '13–18',
      photoAlt: 'Five smiling teenagers outdoors',
      link: 'Going abroad? All exchanges, scholarships and camps →',
      linkHref: '/en/abroad',
    },
    live: 'Free and updated daily',
    press: 'Featured in:',
    years: 'years',
  },
};

export default function HomeHero({ total, freeCount, sourceCount, lang = 'uk' }) {
  const [mode, setMode] = useState('parents');
  useEffect(() => {
    const apply = (m) => {
      setMode(m);
      document.documentElement.dataset.mode = m;
    };
    apply(readMode());
    const off = onModeChange(apply);
    return () => {
      off();
      delete document.documentElement.dataset.mode;
    };
  }, []);

  const t = COPY[lang] || COPY.uk;
  const c = t[mode];
  const isEn = lang === 'en';
  const photo = mode === 'teens' ? '/hero-teens' : '/hero-kids';

  // total і sourceCount на /en можуть прийти рядком-запаскою («400+»), тому
  // українські відмінки рахуємо лише для чисел, англійські слова — сталі.
  const stats = [
    { num: total, label: isEn ? 'opportunities' : opportunitiesWord(total) },
    { num: freeCount, label: isEn ? 'free' : freeWord(freeCount) },
    { num: sourceCount, label: isEn ? 'sources' : sourcesWord(sourceCount) },
    { num: c.age, label: t.years },
  ];

  return (
    <section className="v2-hero-band">
    <div className="v2-hero">
      <div className="v2-hero-copy">
        <div className="v2-hero-status">
          <span className="v2-dot" aria-hidden="true" />
          {t.live}
        </div>
        <h1>
          {c.lead} <span className="v2-script">{c.script}</span>{c.tail}
        </h1>
        <p className="v2-hero-sub">{c.sub}</p>
        {c.link ? (
          <Link href={c.linkHref} className="v2-hero-link">{c.link}</Link>
        ) : null}

        <div className="v2-stats">
          {stats.map((s) => (
            <div className="v2-stat" key={s.label}>
              <span className="v2-stat-num">{s.num}</span>
              <span className="v2-stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Медіазгадки — одразу в хіро: довіру будують там, де людина
            вирішує, лишатися чи ні. Компонент спільний із /press і /about. */}
        <div className="hero-press">
          <Link href={isEn ? '/en/press' : '/press'} className="hero-press-label">
            {t.press}
          </Link>
          <PressLogos />
        </div>
      </div>

      {/* Праворуч від тексту — жива фотографія замість порожнечі. webp із
          jpg-запасним варіантом; розміри задані, щоб верстка не стрибала,
          поки картинка вантажиться. key={mode} перемонтовує <picture> при
          зміні режиму: інакше браузер не завжди переобирає <source>. */}
      <div className="v2-hero-photo">
        <picture key={mode}>
          <source srcSet={`${photo}.webp`} type="image/webp" />
          <img
            src={`${photo}.jpg`}
            width={880}
            height={543}
            alt={c.photoAlt}
            fetchPriority="high"
          />
        </picture>
      </div>
    </div>
    </section>
  );
}
