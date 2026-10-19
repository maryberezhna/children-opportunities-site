// «Наші можливості» — власні продукти Dityam.com.ua, окремо від чужих
// можливостей у «Підбірках». Один список для шапки й сторінки
// /nashi-mozhlyvosti (Марія, 13.10.2026: «створи сторінку, де будуть саме
// наші можливості»). Тексти — з описів самих сторінок, нічого понад них.
import { OLIMP, OLIMP_OPEN, OLIMP_PUBLIC } from './olimpiada.js';
import { MK } from './modnyi-kod.js';

export const OWN_PATH = '/nashi-mozhlyvosti';
export const OWN_LABEL = 'Наші можливості';

// Ціна Dityam+ береться з коду оплати (lib/wayforpay.js), але сюди передаються
// параметром: цей файл імпортує й шапка в браузері, а wayforpay тягне crypto.
export function ownOpportunities({ plusMonth = 99 } = {}) {
  return [
    // Олімпіада — лише поки сторінка відкрита.
    ...(OLIMP_OPEN || OLIMP_PUBLIC ? [{
      key: 'olimpiada',
      href: '/olimpiada',
      label: 'Онлайн-олімпіада з логіки',
      note: `для дітей ${OLIMP.groupLabel} · ${OLIMP_OPEN ? 'безкоштовно' : 'скоро старт'}`,
      text: `${OLIMP.questionCount} завдань за ${OLIMP.minutes} хвилин у зручний час. Участь безкоштовна: диплом одразу, призи щомісяця.`,
      cta: 'Пройти олімпіаду',
    }] : []),
    {
      key: 'modnyi-kod',
      href: `/${MK.slug}`,
      label: `«${MK.title}» — олімпіада з моди`,
      note: `для дітей ${MK.ageFrom}–${MK.ageTo} років · ${MK.open ? 'безкоштовно' : 'скоро старт'}`,
      text: 'Тест про кольори, тканини й стилі, студія образу й обкладинка модного журналу з балами. Участь безкоштовна.',
      cta: 'Детальніше',
    },
    {
      key: 'plus',
      href: '/plus',
      label: 'Dityam+',
      note: `у Telegram · ${plusMonth}\u00A0грн/міс`,
      text: 'Щодня добираємо можливості для кожної дитини за віком, вподобаннями й містом і нагадуємо про дедлайни.',
      cta: 'Детальніше',
    },
  ];
}
