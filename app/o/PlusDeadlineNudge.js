'use client';
import Link from 'next/link';
import { trackConversion } from '@/lib/track';

/**
 * Dityam+ у точці потреби (02.10.2026): людина дивиться на дедлайн — саме
 * тут пропозиція «нагадаємо» має сенс. Канал лишається головним закликом
 * сторінки (рішення 27.09.2026), це лише рядок під датою.
 *
 * Обіцяємо рівно те, що робить Dityam+: нагадування про можливості, які
 * підходять дитині за профілем (scraper/deadline_reminders.py). Нагадування
 * саме про цей запис бот не вміє — тому й не «нагадати про цей дедлайн».
 *
 * Веде на /plus, а не в бот: як і банер унизу сторінки, це знайомство, а не
 * каса (Марія, 30.09.2026).
 */
const T = {
  uk: { text: 'Не пропустіть такі дедлайни: Dityam+ нагадує в Telegram про можливості для вашої дитини', href: '/plus' },
  en: { text: 'Don’t miss deadlines like this: Dityam+ reminds you on Telegram about opportunities for your child', href: '/en/plus' },
};

export default function PlusDeadlineNudge({ lang = 'uk', place, className = '' }) {
  const t = T[lang] || T.uk;
  return (
    <Link
      href={t.href}
      className={`o-plus-nudge ${className}`.trim()}
      onClick={() => trackConversion('plus_nudge_click', { event_label: place })}
    >
      <span aria-hidden="true">🔔</span>
      <span>{t.text} <span aria-hidden="true">→</span></span>
    </Link>
  );
}
