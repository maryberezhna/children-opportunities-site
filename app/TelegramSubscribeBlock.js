'use client';
import { trackConversion, trackSubscribeClick } from '@/lib/track';
import { TELEGRAM_URL, CHANNEL_CTA } from '@/lib/social';

/**
 * Постійний блок підписки — на відміну від підказки біля кнопки, він нікуди
 * не зникає. Потрібен там, де людина читає довго: на сторінки можливостей
 * приземляється 53% сесій (285 із 421 органічних за місяць), середній візит —
 * хвилини, а десятисекундна підказка ловить із них лічені відсотки.
 *
 * `place` іде в аналітику: видно, яке саме розміщення приводить підписників.
 */
const ARIA = {
  uk: 'Telegram-канал Dityam.com.ua',
  en: 'Dityam.com.ua Telegram channel',
};

// place → placement у subscribe_click: назви в одному ряду з 'popup',
// 'hub_inline' і 'catalog_inline'.
const PLACEMENT = {
  detail_page: 'opportunity_block',
};

export default function TelegramSubscribeBlock({ place = 'detail_page', lang = 'uk' }) {
  // Слова — спільні для всіх закликів до каналу (lib/social.js).
  const t = { ...(CHANNEL_CTA[lang] || CHANNEL_CTA.uk), aria: ARIA[lang] || ARIA.uk };
  const handleClick = () => {
    trackConversion('telegram_join_click', { event_label: place });
    // Одна подія на всі входи «підписатись із сайту» (lib/track.js).
    trackSubscribeClick({ target: 'channel', placement: PLACEMENT[place] || place });
  };

  return (
    <aside className="tg-block" aria-label={t.aria}>
      <div className="tg-block-text">
        <h2 className="tg-block-title">{t.title}</h2>
        <p className="tg-block-desc">{t.text}</p>
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
