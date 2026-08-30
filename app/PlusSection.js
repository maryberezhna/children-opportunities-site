'use client';
import { useState } from 'react';
import { opportunitiesWord } from '@/lib/plural';
import { trackConversion } from '@/lib/track';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';

/**
 * Смуга Dityam+ усередині каталогу. Винесена з SupportPopup, бо блок
 * повторюється кілька разів на сторінці, а плаваюче сердечко з модалкою —
 * рівно одне.
 *
 * Продаж на паузі, поки продукт дороблюється: замість кнопок оплати —
 * лист очікування. Email летить у plus_waitlist + сповіщенням у бот.
 * `index` іде в аналітику — видно, який повтор блоку приводить людей.
 */
export default function PlusSection({ total, index = 0 }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error

  const trackMonobank = () => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'monobank_click');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setState('error');
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: `catalog_slot_${index}` }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'server');
      setState('done');
      trackConversion('plus_waitlist_submit', {
        event_label: `catalog_slot_${index}`,
      });
    } catch (err) {
      setState('error');
    }
  };

  return (
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
          {state === 'done' ? (
            <div className="plus-wait-done" role="status">
              <strong>Ви в списку! 🧡</strong>
              <p>Напишемо першим, щойно Dityam+ буде готовий — разом із бонусом за очікування.</p>
            </div>
          ) : (
            <>
              <p className="plus-wait-note">
                <span className="plus-soon">скоро</span>
                Ми саме дороблюємо Dityam+ — платну підписку (179 грн/міс або 1 490 грн/рік).
                Залиште email — дізнаєтесь про запуск першими й отримаєте
                знижку на старті.
              </p>
              <form className="plus-wait-form" onSubmit={submit}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
                  placeholder="ваш@email.com"
                  aria-label="Email для списку очікування"
                  autoComplete="email"
                />
                <button type="submit" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Хвилинку…' : 'Дізнатися першим'}
                </button>
              </form>
              {state === 'error' && (
                <p className="plus-wait-error">Перевірте email — здається, у ньому одрук.</p>
              )}
            </>
          )}
          <p className="plus-fine">
            Каталог лишається безкоштовним для всіх · жодного спаму ·{' '}
            <a href={MONOBANK_URL} target="_blank" rel="noopener noreferrer" onClick={trackMonobank}>підтримати проєкт</a>
          </p>
        </div>
      </div>
    </section>
  );
}
