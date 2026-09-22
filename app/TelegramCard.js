'use client';
import { useEffect, useState } from 'react';
import { TELEGRAM_URL } from '@/lib/social';
import { trackConversion } from '@/lib/track';
import { JOINED_KEY } from './SubscribePopup';

// Картка каналу просто в списку можливостей. Замінила 4-секундний тригер
// спливної підказки: за 23.08–22.09 із 3 049 показів підказки 70% зникли
// самі через 10 секунд, ніхто їх не встиг помітити. Картка в стрічці не має
// таймера, не перекриває нічого і її бачить кожен, хто гортає.
const COPY = {
  uk: {
    aria: 'Telegram-канал Dityam.com.ua',
    title: 'Нові можливості щодня',
    text: 'Канал Dityam.com.ua: щодня один пост — нова можливість або добірка за темою.',
    cta: 'Долучитися',
  },
  en: {
    aria: 'Dityam.com.ua Telegram channel',
    title: 'New opportunities every day',
    text: 'The Dityam.com.ua channel: one post a day — a new opportunity or a themed pick. Posts are in Ukrainian.',
    cta: 'Join',
  },
};

// `place`: 'catalog' — головна й міські сторінки, 'topic' — підбірки.
// Іде в GA4 як popup_trigger, щоб рахуватись поруч зі спливною підказкою.
export default function TelegramCard({ lang = 'uk', place = 'catalog' }) {
  const [joined, setJoined] = useState(false);
  const t = COPY[lang] || COPY.uk;

  // Уже долучився (той самий прапорець, що й у підказки) — картку не показуємо.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(JOINED_KEY)) setJoined(true);
    } catch (e) {}
  }, []);

  if (joined) return null;

  const handleClick = () => {
    try {
      window.localStorage.setItem(JOINED_KEY, Date.now().toString());
    } catch (e) {}
    trackConversion('telegram_join_click', {
      event_label: 'inline_card',
      popup_trigger: `inline_card_${place}`,
    });
  };

  return (
    <aside className="tg-card" aria-label={t.aria}>
      <div className="tg-card-copy">
        <span className="tg-card-badge">Telegram</span>
        <h3 className="tg-card-title">{t.title}</h3>
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
