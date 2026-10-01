'use client';
import { usePathname } from 'next/navigation';
import { TELEGRAM_URL, CHANNEL_CTA } from '@/lib/social';
import ShareButton from './ShareButton';

/**
 * Нижня панель підбірок і міських сторінок на телефоні.
 *
 * З 01.10.2026 — такий самий вигляд, як панель на сторінці можливості
 * (app/o/shared.js, .o-m-bar): одна помаранчева дія на всю ширину й кругла
 * кнопка «Поділитися». Марія: «кнопки на телеграм, інстаграм — що попало,
 * зроби так само, як на сторінці можливостей». До того тут стояли три
 * пігулки різних кольорів (синій Telegram, градієнтний Instagram, біла
 * «Поділитися»). Головна дія підбірки — канал (рішення 27.09.2026);
 * Instagram лишається у футері.
 */
export default function StickyBar() {
  const isEn = (usePathname() || '/').startsWith('/en');
  const lang = isEn ? 'en' : 'uk';
  const cta = CHANNEL_CTA[lang] || CHANNEL_CTA.uk;
  const t = isEn
    ? { share: 'Share', copied: 'Link copied', title: 'Dityam.com.ua' }
    : { share: 'Поділитися', copied: 'Посилання скопійовано', title: 'Dityam.com.ua' };

  const trackTelegram = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'telegram_click', { event_label: 'sticky_bar' });
    }
  };

  return (
    <div className="sticky-bar">
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="sticky-main"
        onClick={trackTelegram}
      >
        {cta.cta}
      </a>
      <ShareButton
        className="sticky-share"
        icon
        title={t.title}
        label={t.share}
        copiedLabel={t.copied}
        place="sticky_bar"
      />
    </div>
  );
}
