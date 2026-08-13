'use client';
import Link from 'next/link';
import { opportunitiesWord } from '@/lib/plural';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';

/**
 * Смуга Dityam+ усередині каталогу. Винесена з SupportPopup, бо блок
 * повторюється кілька разів на сторінці, а плаваюче сердечко з модалкою —
 * рівно одне: якби вони лишались в одному компоненті, кожен повтор додавав
 * би ще одну кнопку поверх іншої.
 *
 * `index` іде в аналітику, щоб було видно, який саме повтор дає кліки —
 * без цього не зрозуміти, чи варті нижні блоки місця.
 */
export default function PlusSection({ total, price, index = 0 }) {
  const trackPlus = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'plus_cta_click', {
        event_category: 'engagement',
        event_label: `catalog_slot_${index}`,
      });
    }
  };

  const trackMore = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'plus_more_click', {
        event_category: 'engagement',
        event_label: `catalog_slot_${index}`,
      });
    }
  };

  const trackMonobank = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'monobank_click');
    }
  };

  return (
    /* Компактна смуга: заголовок, чипи переваг і дві кнопки. Все зайве
       звідси вже прибрано — блок стоїть усередині каталогу й повторюється,
       тож кожен зайвий рядок множиться на кількість повторів. */
    <section className="plus-section">
      <div className="plus-glow" aria-hidden="true" />
      <div className="plus-inner">
        <div className="plus-copy">
          <div className="plus-head">
            <span className="plus-badge">Dityam+</span>
            <h2 className="plus-title">Ми знайдемо і нагадаємо. Ви просто подастесь.</h2>
          </div>
          <p className="plus-lead">
            Каталог показує, що існує — і він відкритий для всіх.
            Але якщо немає часу перебирати {total ? `${total} ${opportunitiesWord(total)}` : 'сотні карток'} і
            стежити за дедлайнами, Dityam+ бере це на себе.
          </p>
          {/* Чипи замість списку: та сама суть, чверть висоти */}
          <div className="plus-chips" aria-label="Переваги підписки">
            <span>відбирає ваші</span>
            <span>нагадує вчасно</span>
            <span>допомагає подати</span>
          </div>
        </div>

        <div className="plus-side">
          <div className="plus-buy">
            {/* Ціна всередині кнопки, а не поруч: окремим рядком вона
                читалась як підпис до чогось іншого, а в кнопці одразу
                відповідає на питання «скільки це коштує». */}
            <Link href="/pidbirka" className="plus-cta" onClick={trackPlus}>
              Спробувати Dityam+
              <span className="plus-cta-price">{price} грн/міс</span>
            </Link>
            {/* Веде на ту саму сторінку, але окремою подією: «Спробувати»
                тиснуть готові, «Дізнатися більше» — ті, кому ще треба
                почитати. Розрізняти їх у GA важливіше, ніж економити лінк. */}
            <Link href="/pidbirka" className="plus-more" onClick={trackMore}>
              Дізнатися більше
            </Link>
          </div>
          <p className="plus-fine">
            Каталог лишається безкоштовним для всіх · скасувати будь-коли ·{' '}
            <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer" onClick={trackMonobank}>підтримати проєкт</a>
          </p>
        </div>
      </div>
    </section>
  );
}
