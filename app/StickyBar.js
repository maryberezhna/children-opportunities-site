'use client';
import { usePathname } from 'next/navigation';
import { TELEGRAM_URL, INSTAGRAM_URL } from '@/lib/social';
import ShareButton from './ShareButton';


// Нижня панель на телефоні (≤640px, responsive.css). До 27.09.2026 у ній були
// ще «Підписатись» ✉️ і «🚀 Dityam+». Перша відкривала ту саму підказку про
// канал, що й кнопка Telegram поруч, а конверт обіцяв розсилку листами, якої
// немає. Друга суперечила «сходинці» (рішення Марії 27.09.2026): сайт веде в
// канал, а Dityam+ на сайті — лише в шапці, на /plus і на /dedlainy.
//
// 30.09.2026 звідси прибрано «Написати» з міткою sticky-desktop-only. Його не
// бачив ніхто й ніколи: панель схована на десктопі цілком, а на телефоні цю
// мітку ховає медіазапит. Написати нам можна з підвалу й зі сторінки
// /contacts — там воно й лишається.
export default function StickyBar() {
  // Мову беремо зі шляху: панель стоїть і на /en/kyiv, а власного пропа
  // мови в неї немає.
  const isEn = (usePathname() || '/').startsWith('/en');
  const t = isEn
    ? { share: 'Share', copied: 'Link copied', title: 'Dityam.com.ua' }
    : { share: 'Поділитися', copied: 'Посилання скопійовано', title: 'Dityam.com.ua' };

  const trackInstagram = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'instagram_click', { event_label: 'sticky_bar' });
    }
  };

  const trackTelegram = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'telegram_click', { event_label: 'sticky_bar' });
    }
  };

  return (
    <div className="sticky-bar">
      {/* Канал — перший: головний заклик сайту (рішення Марії 27.09.2026). */}
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="sticky-btn sticky-btn-tg"
        aria-label="Telegram-канал"
        onClick={trackTelegram}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
        </svg>
        <span>Telegram</span>
      </a>

      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="sticky-btn sticky-btn-insta"
        aria-label="Instagram"
        onClick={trackInstagram}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
        <span>Instagram</span>
      </a>

      {/* Поділитися — з 30.09.2026 на прохання Марії: підбіркою діляться так
          само часто, як окремою можливістю, а в панелі цього не було. */}
      <ShareButton
        className="sticky-btn sticky-btn-share"
        title={t.title}
        label={t.share}
        copiedLabel={t.copied}
        place="sticky_bar"
      />
    </div>
  );
}
