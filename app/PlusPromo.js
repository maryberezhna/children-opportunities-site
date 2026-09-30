import { plusFromUrl } from '@/lib/plus';
import BotLink from './plus/BotLink';

/**
 * Блок Dityam+ унизу сторінки можливості — між «Схожими можливостями» і
 * футером (рішення Марії 30.09.2026). До того з 27.09.2026 сторінка вела
 * лише в канал («сходинка»); тепер людина, що дочитала до кінця, бачить і
 * платну підписку. Слова — ті самі, що були в картці підбірок 28.09.2026
 * (#532): нічого не обіцяємо понад те, що робить Dityam+, і без міста.
 *
 * Кнопка — одразу в бот з міткою opportunity_page: бот записує джерело
 * (parseSourceArg, до 40 символів), у GA4 — plus_bot_click через BotLink.
 */
const T = {
  uk: {
    badge: 'Dityam+',
    title: 'Тут показуємо все, що існує. Dityam+ надсилає те, що підходить саме вашій дитині.',
    text: 'Ви один раз розповідаєте про кожну дитину, а ми щодня перевіряємо нові можливості й надсилаємо '
      + 'в Telegram ті, що підходять їй за віком і вподобаннями. Про дедлайн нагадуємо, поки ще встигаєте подати заявку.',
    cta: 'Оформити в Telegram',
  },
  en: {
    badge: 'Dityam+',
    title: 'Here we show everything that exists. Dityam+ sends what fits your child.',
    text: 'Tell us about each child once, and every day we check new opportunities and send you the ones '
      + 'that fit their age and interests on Telegram. We remind you of deadlines while there is still time to apply.',
    cta: 'Subscribe on Telegram',
  },
};

export default function PlusPromo({ lang = 'uk' }) {
  const t = T[lang] || T.uk;
  const place = lang === 'en' ? 'opportunity_page_en' : 'opportunity_page';
  return (
    <aside className="plus-promo" aria-label="Dityam+">
      <div className="plus-promo-copy">
        <span className="plus-promo-badge">{t.badge}</span>
        <h2 className="plus-promo-title">{t.title}</h2>
        <p className="plus-promo-text">{t.text}</p>
      </div>
      <BotLink href={plusFromUrl(place)} place={place} className="plus-promo-btn">
        {t.cta}
      </BotLink>
    </aside>
  );
}
