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
 * 02.10.2026 Марія: «дуже багато тексту, не виглядає як CTA» — банер
 * скорочено до заголовка, одного рядка й ціни; пояснення живе на /plus.
 *
 * Ціна береться з lib/wayforpay (ті самі змінні, що й у боті та на /plus) —
 * щоб на сайті не лишилось місця, де вона застаріла.
 */
const T = {
  uk: {
    badge: 'Dityam+',
    title: 'Можливості саме для вашої дитини — щодня в Telegram',
    text: 'Добираємо за віком і вподобаннями й нагадуємо про дедлайн.',
    price: `${PRICE} грн/міс або ${PRICE_HALF} грн за пів року · скасувати будь-коли`,
    cta: 'Найкращі можливості для моєї дитини',
    href: '/plus',
  },
  en: {
    badge: 'Dityam+',
    title: 'Opportunities picked for your child, daily on Telegram',
    text: 'Matched to age and interests, with deadline reminders.',
    price: `UAH ${PRICE}/month or UAH ${PRICE_HALF} for six months · cancel any time`,
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
