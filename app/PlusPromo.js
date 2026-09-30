import Link from 'next/link';
import { PRICE, PRICE_HALF } from '@/lib/wayforpay';

/**
 * Блок Dityam+ унизу сторінки можливості — між «Схожими можливостями» і
 * футером (рішення Марії 30.09.2026). Слова — ті самі, що в картці підбірок
 * (#532): нічого не обіцяємо понад те, що робить Dityam+, і без міста.
 *
 * Що змінилось 30.09.2026 на прохання Марії:
 *   • кнопки «Оформити в Telegram» тут немає. Банер — місце знайомства, а не
 *     каси: вести з нього одразу в оплату зарано;
 *   • ціна стоїть у самому банері. «Обовʼязково для ознайомлення» — людина
 *     має бачити, скільки це коштує, ще до того, як кудись натисне;
 *   • кнопка веде на /plus, де можна дочитати, а не в бот.
 *
 * Ціна береться з lib/wayforpay (ті самі змінні, що й у боті та на /plus) —
 * щоб на сайті не лишилось місця, де вона застаріла.
 */
const T = {
  uk: {
    badge: 'Dityam+',
    title: 'Тут показуємо все, що існує. Dityam+ надсилає те, що підходить саме вашій дитині.',
    text: 'Ви один раз розповідаєте про кожну дитину, а ми щодня перевіряємо нові можливості й надсилаємо '
      + 'в Telegram ті, що підходять їй за віком і вподобаннями. Про дедлайн нагадуємо, поки ще встигаєте подати заявку.',
    price: `${PRICE} грн на місяць або ${PRICE_HALF} грн за пів року. Скасувати можна будь-коли.`,
    cta: 'Найкращі можливості для моєї дитини',
    href: '/plus',
  },
  en: {
    badge: 'Dityam+',
    title: 'Here we show everything that exists. Dityam+ sends what fits your child.',
    text: 'Tell us about each child once, and every day we check new opportunities and send you the ones '
      + 'that fit their age and interests on Telegram. We remind you of deadlines while there is still time to apply.',
    price: `UAH ${PRICE} a month or UAH ${PRICE_HALF} for six months. Cancel any time.`,
    cta: 'The best opportunities for my child',
    href: '/en/plus',
  },
};

export default function PlusPromo({ lang = 'uk' }) {
  const t = T[lang] || T.uk;
  return (
    <aside className="plus-promo" aria-label="Dityam+">
      <div className="plus-promo-copy">
        <span className="plus-promo-badge">{t.badge}</span>
        <h2 className="plus-promo-title">{t.title}</h2>
        <p className="plus-promo-text">{t.text}</p>
        <p className="plus-promo-price">{t.price}</p>
      </div>
      <Link href={t.href} className="plus-promo-btn">{t.cta}</Link>
    </aside>
  );
}
