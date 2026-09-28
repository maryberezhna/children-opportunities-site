'use client';
import { useEffect, useRef, useState } from 'react';
import { TELEGRAM_URL, CHANNEL_CTA } from '@/lib/social';
import { trackConversion, trackSubscribeClick } from '@/lib/track';
import { JOINED_KEY } from './SubscribePopup';
import { holdChannelCta } from '@/lib/channel-cta';

// Картка каналу просто в списку можливостей. Замінила 4-секундний тригер
// спливної підказки: за 23.08–22.09 із 3 049 показів підказки 70% зникли
// самі через 10 секунд, ніхто їх не встиг помітити. Картка в стрічці не має
// таймера, не перекриває нічого і її бачить кожен, хто гортає.
//
// Слова — спільні для всіх закликів до каналу (lib/social.js). До 27.09.2026
// картка казала «щодня один пост», хоча формат каналу ще змінюється.
const ARIA = {
  uk: 'Telegram-канал Dityam.com.ua',
  en: 'Dityam.com.ua Telegram channel',
};

// `place`: 'catalog' — головна й міські сторінки, 'topic' — підбірки,
// 'detail_page' — під описом можливості, 'home_bottom' — блок унизу головної.
// Іде в GA4 як popup_trigger, щоб рахуватись поруч зі спливною підказкою.
// `hub` — slug підбірки з lib/topics.js: з якої саме підбірки долучаються.
//
// placement у subscribe_click — в одному ряду з 'popup'. Мітки для
// detail_page лишились ті самі, що були у власного блоку сторінки
// можливості, щоб звіти до 28.09.2026 порівнювались.
const PLACEMENT = {
  catalog: 'catalog_inline',
  topic: 'hub_inline',
  detail_page: 'opportunity_block',
  home_bottom: 'home_bottom',
};
// `variant`: 'inline' — між картками можливостей, 'panel' — у сітці внизу
// сторінки. Розмітка та сама: до 28.09.2026 блок унизу головної був власною
// версткою з тими самими словами, і людина бачила два різні на вигляд заклики
// до одного каналу (Марія: «створи один дизайн цього блока»).
export default function TelegramCard({
  lang = 'uk', place = 'catalog', hub = null, variant = 'inline',
}) {
  const [joined, setJoined] = useState(false);
  const t = { ...(CHANNEL_CTA[lang] || CHANNEL_CTA.uk), aria: ARIA[lang] || ARIA.uk };

  const boxRef = useRef(null);

  // Уже долучився (той самий прапорець, що й у підказки) — картку не показуємо.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(JOINED_KEY)) setJoined(true);
    } catch (e) {}
  }, []);

  // Поки картка в полі зору — спливна підказка мовчить (lib/channel-cta.js).
  // Без IntersectionObserver (дуже старі браузери) нічого не роблимо: підказка
  // просто поводиться як раніше.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    let release = null;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !release) release = holdChannelCta();
      else if (!entry.isIntersecting && release) { release(); release = null; }
    }, { rootMargin: '0px' });
    io.observe(el);
    return () => { io.disconnect(); if (release) release(); };
  }, [joined]);

  if (joined) return null;

  const handleClick = () => {
    try {
      window.localStorage.setItem(JOINED_KEY, Date.now().toString());
    } catch (e) {}
    // Стара подія лишається як була, щоб звіти до 27.09.2026 порівнювались.
    trackConversion('telegram_join_click', {
      event_label: place === 'detail_page' ? 'detail_page' : 'inline_card',
      popup_trigger: `inline_card_${place}`,
    });
    // Нова — одна на всі входи «підписатись із сайту» (lib/track.js).
    trackSubscribeClick({
      target: 'channel',
      placement: PLACEMENT[place] || 'catalog_inline',
      hub: place === 'topic' ? hub : null,
    });
  };

  return (
    <aside
      ref={boxRef}
      className={`tg-card${variant === 'panel' ? ' tg-card-panel' : ''}`}
      aria-label={t.aria}
    >
      <div className="tg-card-copy">
        <span className="tg-card-badge">Telegram</span>
        {/* Не заголовок: у списку h3 — назви можливостей, і «Щоб не шукати
            вручну» серед них читачі екрана й пошуковики брали б за ще одну. */}
        <p className="tg-card-title">{t.title}</p>
        <p className="tg-card-text">{t.text}</p>
      </div>
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="tg-card-btn"
        onClick={handleClick}
      >
        {t.cta}
      </a>
    </aside>
  );
}
