'use client';
import { TELEGRAM_URL } from '@/lib/social';
import { trackConversion, trackSubscribeClick } from '@/lib/track';

// Кнопки на плашці «Набір закрито» (19.10.2026): нагадування в календар і
// Telegram-канал. Клієнтський компонент лише заради обліку кліків — сама
// плашка з датами складається на сервері (app/o/shared.js).
export default function ClosedActions({ slug, lang = 'uk', reminder = null, t }) {
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
