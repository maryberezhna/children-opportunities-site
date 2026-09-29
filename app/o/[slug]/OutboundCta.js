'use client';
import { trackOpportunityClick, trackApplyClick } from '@/lib/track';

// Головна кнопка сторінки можливості жила серверним <a> без жодного
// відстеження: найцінніший клік на найкращих сторінках не рахувався ніде, і
// 302 `opportunity_click` за місяць були лише зі списків.
//
// place розрізняє кнопку в тексті сторінки й прибиту панель на телефоні —
// щоб бачити, котра з них працює.
//
// `apply` — це основна кнопка «Подати заявку ↗» (картка дії чи панель на
// телефоні): поруч з opportunity_click шлемо ще й apply_click (lib/track.js).
export default function OutboundCta({
  href, title, id = null, lang = 'uk', className = 'opportunity-cta', place = 'detail_page',
  rel = 'noopener noreferrer', apply = false, children,
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={rel}
      className={className}
      onClick={() => {
        trackOpportunityClick(title, place, id);
        if (apply) trackApplyClick(title, place);
      }}
    >
      {children || (lang === 'en' ? 'Go to the official site ↗' : 'Перейти до офіційного сайту ↗')}
    </a>
  );
}
