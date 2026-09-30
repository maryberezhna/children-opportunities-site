'use client';
import { TELEGRAM_URL } from '@/lib/social';

/**
 * Кругла кнопка каналу для нижньої панелі на телефоні.
 *
 * Окремим клієнтським компонентом, бо сторінка можливості (app/o/shared.js) —
 * серверна: обробник кліку просто в її розмітці валить сторінку
 * («Event handlers cannot be passed to Client Component props»).
 */
export default function ChannelIconLink({ className, label, place = 'detail_page_bar' }) {
  return (
    <a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={label}
      title={label}
      onClick={() => {
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'telegram_click', { event_label: place });
        }
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L8.32 14.617l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.828.942z"/>
      </svg>
    </a>
  );
}
