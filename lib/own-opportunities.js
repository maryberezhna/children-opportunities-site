// «Наші можливості» — власні продукти Dityam.com.ua, окремо від чужих
// можливостей у «Підбірках». Один список для шапки й сторінки
// /nashi-mozhlyvosti (Марія, 13.10.2026: «створи сторінку, де будуть саме
// наші можливості»). Тексти — з описів самих сторінок, нічого понад них.
import { OLIMP, OLIMP_OPEN, OLIMP_PUBLIC } from '@/lib/olimpiada';
import { MK } from '@/lib/modnyi-kod';

export const OWN_PATH = '/nashi-mozhlyvosti';
export const OWN_LABEL = 'Наші можливості';

export function ownOpportunities() {
  return [
    // Олімпіада — лише поки сторінка відкрита.
    ...(OLIMP_OPEN || OLIMP_PUBLIC ? [{
      href: '/olimpiada',
      label: 'Онлайн-олімпіада з логіки',
      note: `для дітей ${OLIMP.groupLabel} · ${OLIMP_OPEN ? 'безкоштовно' : 'скоро старт'}`,
      text: `${OLIMP.questionCount} завдань за ${OLIMP.minutes} хвилин у зручний час. Участь безкоштовна: диплом одразу, призи щомісяця.`,
      cta: 'Пройти олімпіаду',
    }] : []),
    {
      href: `/${MK.slug}`,
      label: `«${MK.title}» — олімпіада з моди`,
      note: `для дітей ${MK.ageFrom}–${MK.ageTo} років · ${MK.open ? `${MK.price}\u00A0грн` : 'скоро старт'}`,
      text: 'Тест про кольори, тканини й стилі, студія образу й обкладинка модного журналу з балами.',
      cta: 'Детальніше',
    },
    {
      href: '/plus',
      label: 'Dityam+',
      note: 'у Telegram · 99\u00A0грн/міс',
      text: 'Щодня добираємо можливості для кожної дитини за віком, вподобаннями й містом і нагадуємо про дедлайни.',
      cta: 'Детальніше',
    },
  ];
}
