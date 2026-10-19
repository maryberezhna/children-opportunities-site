'use client';
import { TELEGRAM_URL } from '@/lib/social';
import { trackConversion, trackSubscribeClick } from '@/lib/track';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dityam.com.ua';
// Той самий календар, що на /sviata: свята й дедлайни конкурсів, оновлюється
// сам. webcal:// відкриває Apple/Outlook як підписку, а не разовий файл.
const WEBCAL_URL = `${SITE_URL}/calendar.ics`.replace(/^https?:\/\//, 'webcal://');
const GOOGLE_SUBSCRIBE_URL = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(WEBCAL_URL)}`;

// Кнопки на плашці «Набір закрито» (19.10.2026): головне — підписка на наш
// календар (Марія: «підписати на наш календар, де ми зможемо хоч якось
// нагадати про себе»), далі нагадування про цей набір (лише коли дата
// попереду) і Telegram-канал. Клієнтський компонент лише заради обліку
// кліків — сама плашка з датами складається на сервері (app/o/shared.js).
export default function ClosedActions({ slug, lang = 'uk', reminder = null, t }) {
  const subscribe = (kind) => () => {
    trackConversion('calendar_subscribe_click', { event_label: kind, placement: 'closed_banner', opportunity_slug: slug });
  };
  const remind = (kind) => () => {
    trackConversion('closed_reminder_click', { event_label: kind, opportunity_slug: slug });
  };
  const joinChannel = () => {
    // Та сама пара подій, що в TelegramCard, із власним місцем: звіти
    // «звідки підписуються» мають бачити плашку окремо.
    trackConversion('telegram_join_click', { event_label: 'closed_banner', popup_trigger: 'closed_banner' });
    trackSubscribeClick({ target: 'channel', placement: 'closed_banner' });
  };

  return (
    <>
      {/* Без заголовка й пояснення — Марія (19.10.2026): «давай без цього».
          Кнопки кажуть усе самі. */}
      <div className="closed-cal">
        <div className="closed-cal-btns">
          <a href={GOOGLE_SUBSCRIBE_URL} target="_blank" rel="noopener noreferrer" onClick={subscribe('google')}>
            {t.calGoogle}
          </a>
          <a href={WEBCAL_URL} onClick={subscribe('webcal')}>
            {t.calApple}
          </a>
        </div>
      </div>
      {reminder ? (
        <div className="closed-remind">
          <p className="closed-remind-title">{t.remindTitle}</p>
          <div className="closed-remind-btns">
            <a href={reminder.googleUrl} target="_blank" rel="noopener noreferrer" onClick={remind('google')}>
              {t.remindGoogle}
            </a>
            <a href={reminder.icsUrl} onClick={remind('ics')}>
              {t.remindApple}
            </a>
          </div>
          <p className="closed-remind-note">{t.remindNote}</p>
        </div>
      ) : null}
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="closed-tg"
        onClick={joinChannel}
      >
        <span className="closed-tg-title">{t.tgTitle}</span>
        <span className="closed-tg-sub">{t.tgSub}</span>
      </a>
    </>
  );
}
