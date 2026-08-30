'use client';
import { trackOpportunityClick } from '@/lib/track';

// Головна кнопка сторінки можливості жила серверним <a> без жодного
// відстеження: найцінніший клік на найкращих сторінках не рахувався ніде, і
// 302 `opportunity_click` за місяць були лише зі списків.
export default function OutboundCta({ href, title }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="opportunity-cta"
      onClick={() => trackOpportunityClick(title, 'detail_page')}
    >
      Перейти до офіційного сайту ↗
    </a>
  );
}
