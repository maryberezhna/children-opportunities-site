'use client';
import { useState } from 'react';
import { opportunitiesWord } from '@/lib/plural';
import { trackConversion } from '@/lib/track';

const MONOBANK_URL = 'https://send.monobank.ua/jar/F72fDrV2c';

// Блок їде і в український каталог, і в англійський.
const L = {
  uk: {
    title: 'Ми знайдемо і нагадаємо. Ви просто подастесь.',
    leadHead: 'Платформа показує, що існує — і вона відкрита для всіх. Але якщо немає часу перебирати',
    leadFallback: 'сотні карток',
    leadTail: 'і стежити за дедлайнами, Dityam+ бере це на себе.',
    chipsLabel: 'Переваги підписки',
    chips: ['відбирає ваші', 'нагадує вчасно', 'допомагає подати'],
    doneTitle: 'Ви в списку! 🧡',
    doneText: 'Напишемо першим, щойно Dityam+ буде готовий — разом із бонусом за очікування.',
    soon: 'скоро',
    waitNote: 'Ми саме дороблюємо Dityam+ — платну підписку (179 грн/міс або 1 490 грн/рік). Залиште email — дізнаєтесь про запуск першими й отримаєте знижку на старті.',
    emailPlaceholder: 'ваш@email.com',
    emailAria: 'Email для списку очікування',
    sending: 'Хвилинку…',
    submit: 'Дізнатися першим',
    error: 'Перевірте email — здається, у ньому одрук.',
    fine: 'Платформа лишається безкоштовною для всіх · жодного спаму · ',
    support: 'підтримати проєкт',
  },
  en: {
    title: 'We’ll find it and remind you. You just apply.',
    leadHead: 'The platform shows what exists — and it’s open to everyone. But if you have no time to sift through',
    leadFallback: 'hundreds of cards',
    leadTail: 'and track deadlines, Dityam+ does it for you.',
    chipsLabel: 'What the subscription does',
    chips: ['picks yours', 'reminds in time', 'helps you apply'],
    doneTitle: 'You’re on the list! 🧡',
    doneText: 'We’ll write to you first the moment Dityam+ is ready — with a thank-you for waiting.',
    soon: 'soon',
    waitNote: 'We’re still building Dityam+, a paid subscription (UAH 179/month or UAH 1,490/year). Leave your email to hear about the launch first and get a discount at the start.',
    emailPlaceholder: 'your@email.com',
    emailAria: 'Email for the waiting list',
    sending: 'One moment…',
    submit: 'Tell me first',
    error: 'Check the email — there seems to be a typo.',
    fine: 'The platform stays free for everyone · no spam · ',
    support: 'support the project',
  },
};

/**
 * Смуга Dityam+ усередині каталогу. Винесена з SupportPopup, бо блок
 * повторюється кілька разів на сторінці, а плаваюче сердечко з модалкою —
 * рівно одне.
 *
 * Продаж на паузі, поки продукт дороблюється: замість кнопок оплати —
 * лист очікування. Email летить у plus_waitlist + сповіщенням у бот.
 * `index` іде в аналітику — видно, який повтор блоку приводить людей.
 */
export default function PlusSection({ total, index = 0, lang = 'uk' }) {
  const t = L[lang] || L.uk;
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
          {state === 'done' ? (
            <div className="plus-wait-done" role="status">
              <strong>{t.doneTitle}</strong>
              <p>{t.doneText}</p>
            </div>
          ) : (
            <>
              <p className="plus-wait-note">
                <span className="plus-soon">{t.soon}</span>
                {t.waitNote}
              </p>
              <form className="plus-wait-form" onSubmit={submit}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
                  placeholder={t.emailPlaceholder}
                  aria-label={t.emailAria}
                  autoComplete="email"
                />
                <button type="submit" disabled={state === 'sending'}>
                  {state === 'sending' ? t.sending : t.submit}
                </button>
              </form>
              {state === 'error' && (
                <p className="plus-wait-error">{t.error}</p>
              )}
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
