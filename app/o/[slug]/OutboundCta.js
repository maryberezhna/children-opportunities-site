'use client';
import { OPPORTUNITY_CLICK_EVENT } from '../../SubscribePopup';

// Головна кнопка сторінки можливості жила серверним <a> без жодного
// відстеження: найцінніший клік на найкращих сторінках не рахувався ніде, і
// 302 `opportunity_click` за місяць були лише зі списків. Тепер сторінка
// віддає і подію в GA4, і момент цінності для підказки про Telegram.
export default function OutboundCta({ href, title }) {
  const handleClick = () => {
    if (typeof window === 'undefined') return;
    if (window.gtag) {
      window.gtag('event', 'opportunity_click', {
        event_category: 'engagement',
        event_label: title,
        event_source: 'detail_page',
      });
    }
    window.dispatchEvent(new CustomEvent(OPPORTUNITY_CLICK_EVENT, {
      detail: { title },
    }));
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="opportunity-cta"
      onClick={handleClick}
    >
      Перейти до офіційного сайту ↗
    </a>
  );
}
