'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import PressLogos from './PressLogos';
import { readMode, onModeChange } from '@/lib/mode';
import { opportunitiesWord, sourcesWord, freeWord } from '@/lib/plural';

// Хіро головної: копія залежить від режиму «Батькам / Підліткам», тому
// компонент клієнтський. SSR завжди віддає батьківську версію — саме її
// бачить Google, і саме вона лишається дефолтом для нових відвідувачів.

const COPY = {
  uk: {
    parents: {
      lead: 'Усі можливості',
      script: 'для вашої дитини',
      tail: ' в одному місці',
      sub: 'Курси, олімпіади, стипендії, табори, медична допомога та виплати '
        + 'для дітей 0–18 років в Україні та за кордоном. Перевірені програми, '
        + 'зібрані вручну.',
    },
    teens: {
      lead: 'Можливості',
      script: 'для тебе',
      tail: ' — обміни, стажування, стипендії',
      sub: 'Усе, на що можна податись самостійно у 13–18: обміни за кордон, '
        + 'стажування, стипендії, волонтерство, підготовка до НМТ. Перевірено, '
        + 'більшість безкоштовно.',
    },
    live: 'Безкоштовно і оновлюється щодня',
    press: 'Про нас пишуть:',
  },
  en: {
    parents: {
      lead: 'Every opportunity',
      script: 'for your child',
      tail: ' in one place',
      sub: 'Courses, olympiads, scholarships, camps, medical aid and payments '
        + 'for children aged 0–18 in Ukraine and abroad. Verified programs, '
        + 'curated by hand.',
    },
    teens: {
      lead: 'Opportunities',
      script: 'for you',
      tail: ' — exchanges, internships, scholarships',
      sub: 'Everything you can apply to on your own at 13–18: exchanges abroad, '
        + 'internships, scholarships, volunteering. Verified, mostly free.',
    },
    live: 'Free and updated daily',
    press: 'Featured in:',
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

  const stats = isEn
    ? `${total} opportunities · ${freeCount} free · ${sourceCount} sources`
    : `${total} ${opportunitiesWord(total)} · ${freeCount} ${freeWord(freeCount)} · ${sourceCount} ${sourcesWord(sourceCount)}`;

  return (
    <section className="v2-hero">
      <div className="v2-hero-status">
        <span className="v2-dot" aria-hidden="true" />
        {t.live}
      </div>
      <h1>
        {c.lead} <span className="v2-script">{c.script}</span>{c.tail}
      </h1>
      <p className="v2-hero-sub">{c.sub}</p>
      <p className="v2-hero-stats">{stats}</p>

      {/* Медіазгадки — одразу в хіро: довіру будують там, де людина
          вирішує, лишатися чи ні. Компонент спільний із /press і /about. */}
      <div className="hero-press">
        <Link href={isEn ? '/en/press' : '/press'} className="hero-press-label">
          {t.press}
        </Link>
        <PressLogos />
      </div>
    </section>
  );
}
