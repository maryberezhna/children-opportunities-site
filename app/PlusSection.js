'use client';
import Link from 'next/link';
import { opportunitiesWord } from '@/lib/plural';
import { trackConversion } from '@/lib/track';
import { PLUS_SALES_OPEN, PLUS_WAITLIST_URL, plusBotUrl } from '@/lib/plus';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';

// Блок їде і в український каталог, і в англійський.
//
// До 14.09.2026 тут стояло «памʼятаємо, куди дитина вже подавалась, і
// пропонуємо наступний крок» і чип «памʼятає пройдене». У коді підписки
// такого немає, тож обіцянку замінено на те, що підписка справді робить.
const L = {
  uk: {
    title: 'Платформа показує все, що існує. Dityam+ надсилає те, що підходить саме вашій дитині.',
    leadHead: 'Щодня ми перебираємо',
    leadFallback: 'сотні можливостей',
    leadTail: 'і надсилаємо вам у Telegram лише ті, що підходять кожній вашій дитині, — з нагадуванням про дедлайн.',
    chipsLabel: 'Переваги підписки',
    chips: ['добирає під кожну дитину', 'лише нове', 'нагадує вчасно'],
    soon: 'скоро',
    waitNote: 'Ми саме дороблюємо Dityam+ — платну підписку (179 грн/міс або 1 199 грн/рік). Станьте в список у Telegram — дізнаєтесь про запуск першими й отримаєте знижку на старті.',
    waitCta: 'Стати в список у Telegram',
    submit: 'Дізнатися першим',
    fine: 'Платформа лишається безкоштовною для всіх · жодного спаму · ',
    support: 'підтримати проєкт',
    openNote: 'Dityam+ — платна підписка: 179 грн/міс або 1 199 грн/рік. Оформлюється в Telegram-боті за кілька хвилин: питання про дитину, потім оплата.',
    openCta: 'Оформити в Telegram',
    openBanner: 'Оформити Dityam+',
  },
  en: {
    title: 'The platform shows everything that exists. Dityam+ sends what fits your child.',
    leadHead: 'Every day we go through',
    leadFallback: 'hundreds of opportunities',
    leadTail: 'and send you on Telegram only the ones that fit each of your children — with a deadline reminder.',
    chipsLabel: 'What the subscription does',
    chips: ['matched to each child', 'only what is new', 'reminds in time'],
    soon: 'soon',
    waitNote: 'We’re still building Dityam+, a paid subscription (UAH 179/month or UAH 1,199/year). Join the list on Telegram to hear about the launch first and get a discount at the start.',
    waitCta: 'Join the list on Telegram',
    submit: 'Tell me first',
    fine: 'The platform stays free for everyone · no spam · ',
    support: 'support the project',
    openNote: 'Dityam+ is a paid subscription: UAH 179/month or UAH 1,199/year. You set it up in the Telegram bot in a few minutes: questions about your child, then payment.',
    openCta: 'Subscribe on Telegram',
    openBanner: 'Get Dityam+',
  },
};

/**
 * Смуга Dityam+ усередині каталогу. Винесена з SupportPopup, бо блок
 * повторюється кілька разів на сторінці, а плаваюче сердечко з модалкою —
 * рівно одне.
 *
 * Продаж на паузі, поки продукт дороблюється: замість кнопок оплати — список
 * очікування в основному боті. До 15.09.2026 тут була форма з імейлом; листів
 * Dityam+ більше не шле (рішення Марії), тож і пошту не просимо.
 * `index` іде в аналітику — видно, який повтор блоку приводить людей.
 */
export default function PlusSection({ total, index = 0, lang = 'uk' }) {
  const t = L[lang] || L.uk;

  const trackMonobank = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'monobank_click');
    }
  };

  return (
    <section className="plus-section">
      <div className="plus-glow" aria-hidden="true" />
      <div className="plus-inner">
        <div className="plus-copy">
          <div className="plus-head">
            <span className="plus-badge">Dityam+</span>
            <h2 className="plus-title">{t.title}</h2>
          </div>
          <p className="plus-lead">
            {t.leadHead}{' '}
            {total
              ? `${total} ${lang === 'en' ? 'opportunities' : opportunitiesWord(total)}`
              : t.leadFallback}{' '}
            {t.leadTail}
          </p>
          {/* Чипи замість списку: та сама суть, чверть висоти */}
          <div className="plus-chips" aria-label={t.chipsLabel}>
            {t.chips.map((c) => <span key={c}>{c}</span>)}
          </div>
        </div>

        <div className="plus-side">
          {PLUS_SALES_OPEN ? (
            // Продаж відкрито (lib/plus.js) — замість списку очікування кнопка в бот.
            <>
              <p className="plus-wait-note">{t.openNote}</p>
              <a
                className="plus-open-btn"
                href={plusBotUrl(`slot_${index}`)}
                onClick={() => trackConversion('plus_bot_click', { event_label: `catalog_slot_${index}` })}
              >
                {t.openCta}
              </a>
            </>
          ) : (
            <>
              <p className="plus-wait-note">
                <span className="plus-soon">{t.soon}</span>
                {t.waitNote}
              </p>
              <a
                className="plus-open-btn"
                href={PLUS_WAITLIST_URL}
                onClick={() => trackConversion('plus_waitlist_tg_click', { event_label: `catalog_slot_${index}` })}
              >
                {t.waitCta}
              </a>
            </>
          )}
          <p className="plus-fine">
            {t.fine}
            <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer" onClick={trackMonobank}>{t.support}</a>
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Той самий Dityam+ чорним банером у колонці каталогу головної (≥1100px,
 * поруч із бічними фільтрами). Замість кнопки в бот — кнопка на /plus: там
 * повне пояснення. Текст — той самий, що в PlusSection.
 */
export function PlusBanner({ total, lang = 'uk' }) {
  const t = L[lang] || L.uk;
  return (
    <section className="plus-banner" aria-labelledby="plus-banner-title">
      <div className="plus-banner-copy">
        <span className="plus-banner-badge">Dityam+</span>
        <h2 id="plus-banner-title" className="plus-banner-title">{t.title}</h2>
        <p className="plus-banner-lead">
          {t.leadHead}{' '}
          {total
            ? `${total} ${lang === 'en' ? 'opportunities' : opportunitiesWord(total)}`
            : t.leadFallback}{' '}
          {t.leadTail}
        </p>
      </div>
      <Link
        href={lang === 'en' ? '/en/plus' : '/plus'}
        className="plus-banner-btn"
        onClick={() => trackConversion('plus_banner_click', { event_label: 'home_catalog' })}
      >
        {PLUS_SALES_OPEN ? t.openBanner : t.submit}
      </Link>
    </section>
  );
}
