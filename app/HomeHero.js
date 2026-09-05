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
// Текст ліворуч, фото праворуч, під текстом — статистика великими цифрами.
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
    },
    teens: {
      lead: 'Можливості',
      script: 'для тебе',
      tail: ' — обміни, стажування, стипендії',
      sub: 'Усе, на що можна податись самостійно у 13–18: обміни за кордон, '
        + 'стажування, стипендії, волонтерство, підготовка до НМТ. Перевірено, '
        + 'більшість безкоштовно.',
      age: '13–18',
    },
    live: 'Безкоштовно і оновлюється щодня',
    press: 'Про нас пишуть:',
    years: 'років',
    photoAlt: 'Усміхнені діти на дитячому майданчику',
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
    },
    teens: {
      lead: 'Opportunities',
      script: 'for you',
      tail: ' — exchanges, internships, scholarships',
      sub: 'Everything you can apply to on your own at 13–18: exchanges abroad, '
        + 'internships, scholarships, volunteering. Verified, mostly free.',
      age: '13–18',
    },
    live: 'Free and updated daily',
    press: 'Featured in:',
    years: 'years',
    photoAlt: 'Smiling children on a playground',
  },
};

export default function HomeHero({ total, freeCount, sourceCount, lang = 'uk' }) {
  const [mode, setMode] = useState('parents');
  useEffect(() => {
    setMode(readMode());
    return onModeChange(setMode);
  }, []);

  const t = COPY[lang] || COPY.uk;
  const c = t[mode];
  const isEn = lang === 'en';

  // total і sourceCount на /en можуть прийти рядком-запаскою («400+»), тому
  // українські відмінки рахуємо лише для чисел, англійські слова — сталі.
  const stats = [
    { num: total, label: isEn ? 'opportunities' : opportunitiesWord(total) },
    { num: freeCount, label: isEn ? 'free' : freeWord(freeCount) },
    { num: sourceCount, label: isEn ? 'sources' : sourcesWord(sourceCount) },
    { num: c.age, label: t.years },
  ];

  return (
    <section className="v2-hero">
      <div className="v2-hero-copy">
        <div className="v2-hero-status">
          <span className="v2-dot" aria-hidden="true" />
          {t.live}
        </div>
        <h1>
          {c.lead} <span className="v2-script">{c.script}</span>{c.tail}
        </h1>
        <p className="v2-hero-sub">{c.sub}</p>

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
          поки картинка вантажиться. */}
      <div className="v2-hero-photo">
        <picture>
          <source srcSet="/hero-kids.webp" type="image/webp" />
          <img
            src="/hero-kids.jpg"
            width={880}
            height={543}
            alt={t.photoAlt}
            fetchPriority="high"
          />
        </picture>
      </div>
    </section>
  );
}
