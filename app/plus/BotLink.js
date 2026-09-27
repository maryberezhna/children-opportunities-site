'use client';
import { trackConversion } from '@/lib/track';
import { PLUS_SALES_OPEN } from '@/lib/plus';

/**
 * Посилання з /plus у бот Dityam+, яке рахується в GA4. Окремий клієнтський
 * компонент, бо сторінка серверна. До 27.09.2026 головна кнопка /plus і блок
 * «кава чи можливість» не писали нічого: зі сторінки, куди тепер веде кожна
 * дорога до Dityam+ на сайті, не було видно, скільки людей дійшло до бота.
 *
 * `place` — та сама мітка, що й у посиланні (`?start=from_<place>`): в GA4 і в
 * базі (`digest_subscribers.source`) одне місце зветься однаково.
 */
export default function BotLink({ href, place, className, children, ...rest }) {
  const track = () => trackConversion(
    PLUS_SALES_OPEN ? 'plus_bot_click' : 'plus_waitlist_tg_click',
    { event_label: place },
  );
  return (
    <a href={href} className={className} onClick={track} {...rest}>
      {children}
    </a>
  );
}
