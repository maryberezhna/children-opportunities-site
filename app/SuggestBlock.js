'use client';
import { useState, useEffect } from 'react';

/**
 * «Маєте можливість? Напишіть нам — і ми її опублікуємо».
 * Смуга всередині сітки каталогу (кожні ~30 карток) із поп-ап формою.
 *
 * Це не лише зручність для організаторів — це канал виявлення: пропозиції
 * приходять від людей, які вже знають про можливість, тобто саме те, чого
 * скрапери не бачать.
 */
// Блок стоїть і в українському каталозі, і в англійському.
const L = {
  uk: {
    kicker: 'Для організаторів',
    heading: 'Маєте можливість для дітей?',
    lead: 'Напишіть нам — перевіримо й опублікуємо безкоштовно.',
    cta: 'Запропонувати',
    close: 'Закрити',
    doneTitle: 'Дякуємо!',
    doneText: 'Ми перевіримо можливість і опублікуємо її. Якщо лишили контакт — напишемо, коли вона зʼявиться.',
    doneBtn: 'Готово',
    formTitle: 'Запропонувати можливість',
    formSub: 'Табір, курс, конкурс, стипендія — будь-що корисне для дітей 0–18. Публікація безкоштовна.',
    nameLabel: 'Назва можливості',
    namePlaceholder: 'Напр., Безкоштовний табір робототехніки',
    linkLabel: 'Посилання',
    aboutLabel: 'Кілька слів про неї',
    optional: 'необовʼязково',
    aboutPlaceholder: 'Для кого, коли, що треба для участі',
    contactLabel: 'Ваш контакт',
    contactHint: 'якщо можна щось уточнити',
    contactPlaceholder: '@telegram або email',
    error: 'Додайте назву або посилання — інакше нам нема що перевіряти.',
    sending: 'Надсилаємо…',
    submit: 'Надіслати',
  },
  en: {
    kicker: 'For organisers',
    heading: 'Running something for children?',
    lead: 'Tell us — we’ll check it and publish it for free.',
    cta: 'Suggest it',
    close: 'Close',
    doneTitle: 'Thank you!',
    doneText: 'We’ll check the opportunity and publish it. If you left a contact, we’ll write when it appears.',
    doneBtn: 'Done',
    formTitle: 'Suggest an opportunity',
    formSub: 'A camp, a course, a contest, a scholarship — anything useful for children 0–18. Publishing is free.',
    nameLabel: 'Name of the opportunity',
    namePlaceholder: 'e.g. Free robotics camp',
    linkLabel: 'Link',
    aboutLabel: 'A few words about it',
    optional: 'optional',
    aboutPlaceholder: 'Who it’s for, when, what’s needed to take part',
    contactLabel: 'Your contact',
    contactHint: 'in case we need to check something',
    contactPlaceholder: '@telegram or email',
    error: 'Add a name or a link — otherwise there’s nothing for us to check.',
    sending: 'Sending…',
    submit: 'Send',
  },
};

export default function SuggestBlock({ lang = 'uk' } = {}) {
  const t = L[lang] || L.uk;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [form, setForm] = useState({ title: '', url: '', comment: '', contact: '', website: '' });

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  const openForm = () => {
    setOpen(true);
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'suggest_open', { event_category: 'engagement' });
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.title.trim().length < 5 && !form.url.trim()) {
      setState('error');
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.ok) throw new Error('server');
      setState('done');
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'suggest_submit', { event_category: 'conversion' });
      }
    } catch (err) {
      setState('error');
    }
  };

  const close = () => {
    setOpen(false);
    // Після успішної відправки наступне відкриття — з чистою формою.
    if (state === 'done') {
      setForm({ title: '', url: '', comment: '', contact: '', website: '' });
      setState('idle');
    }
  };

  return (
    <>
      {/* Стоїть у сітці як звичайна картка, але інвертована: чорне тло й
          помаранчева рамка виділяють її, не ламаючи ритму колонок. */}
      <section className="suggest-card">
        <span className="suggest-kicker">{t.kicker}</span>
        <h2>{t.heading}</h2>
        <p>{t.lead}</p>
        <button type="button" className="suggest-cta" onClick={openForm}>
          {t.cta}
        </button>
      </section>

      {open ? (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal suggest-modal" role="dialog" aria-modal="true" aria-labelledby="suggest-title">
            <button className="modal-close" onClick={close} aria-label={t.close}>✕</button>

            {state === 'done' ? (
              <div className="suggest-done">
                <div className="modal-icon">💛</div>
                <h2 id="suggest-title">{t.doneTitle}</h2>
                <p>{t.doneText}</p>
                <button type="button" className="suggest-cta" onClick={close}>{t.doneBtn}</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 id="suggest-title">{t.formTitle}</h2>
                <p className="suggest-sub">{t.formSub}</p>

                <label className="suggest-label">
                  {t.nameLabel}
                  <input
                    type="text"
                    value={form.title}
                    onChange={set('title')}
                    placeholder={t.namePlaceholder}
                    maxLength={300}
                  />
                </label>

                <label className="suggest-label">
                  {t.linkLabel}
                  <input
                    type="url"
                    value={form.url}
                    onChange={set('url')}
                    placeholder="https://…"
                    maxLength={500}
                  />
                </label>

                <label className="suggest-label">
                  {t.aboutLabel} <span className="suggest-opt">{t.optional}</span>
                  <textarea
                    value={form.comment}
                    onChange={set('comment')}
                    rows={3}
                    placeholder={t.aboutPlaceholder}
                    maxLength={2000}
                  />
                </label>

                <label className="suggest-label">
                  {t.contactLabel} <span className="suggest-opt">{t.contactHint}</span>
                  <input
                    type="text"
                    value={form.contact}
                    onChange={set('contact')}
                    placeholder={t.contactPlaceholder}
                    maxLength={200}
                  />
                </label>

                {/* Honeypot: людина його не бачить, бот заповнює */}
                <input
                  type="text"
                  value={form.website}
                  onChange={set('website')}
                  className="suggest-hp"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                {state === 'error' && (
                  <p className="suggest-error">
                    {t.error}
                  </p>
                )}

                <button type="submit" className="suggest-cta suggest-submit" disabled={state === 'sending'}>
                  {state === 'sending' ? t.sending : t.submit}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
