'use client';
import { trackConversion } from '@/lib/track';
import { TELEGRAM_URL } from '@/lib/social';

/**
 * Постійний блок підписки — на відміну від підказки біля кнопки, він нікуди
 * не зникає. Потрібен там, де людина читає довго: на сторінки можливостей
 * приземляється 53% сесій (285 із 421 органічних за місяць), середній візит —
 * хвилини, а десятисекундна підказка ловить із них лічені відсотки.
 *
 * `place` іде в аналітику: видно, яке саме розміщення приводить підписників.
 */
const L = {
  uk: {
    aria: 'Telegram-канал Dityam',
    title: 'Щоб не шукати вручну',
    desc: 'Нові можливості для дітей виходять щодня в Telegram — з датами й дедлайнами. Кожну перевіряємо руками перед публікацією.',
    cta: 'Долучитися до каналу',
  },
  en: {
    aria: 'Dityam Telegram channel',
    title: 'So you don’t have to keep looking',
    desc: 'New opportunities for children go out on Telegram every day — with dates and deadlines. Each one is checked by hand before it’s published. Posts are in Ukrainian.',
    cta: 'Join the channel',
  },
};

export default function TelegramSubscribeBlock({ place = 'detail_page', lang = 'uk' }) {
  const t = L[lang] || L.uk;
  const handleClick = () => {
    trackConversion('telegram_join_click', { event_label: place });
  };

  return (
    <aside className="tg-block" aria-label={t.aria}>
      <div className="tg-block-text">
        <h2 className="tg-block-title">{t.title}</h2>
        <p className="tg-block-desc">{t.desc}</p>
      </div>

      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="tg-cta tg-block-cta"
        onClick={handleClick}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
        </svg>
        {t.cta}
      </a>
    </aside>
  );
}
