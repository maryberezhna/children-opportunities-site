'use client';
import { useState, useEffect } from 'react';
import { parseContact } from '@/lib/contactAddress';
import { readExtras, extrasProblem } from '@/lib/suggestExtras';

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
    doneText: 'Ми перевіримо можливість і опублікуємо її, а коли вона зʼявиться — напишемо вам.',
    doneBtn: 'Готово',
    formTitle: 'Запропонувати можливість',
    formSub: 'Табір, курс, конкурс, стипендія — будь-що корисне для дітей 0–18. Публікація безкоштовна.',
    nameLabel: 'Назва можливості',
    namePlaceholder: 'Напр., Безкоштовний табір робототехніки',
    linkLabel: 'Посилання',
    aboutLabel: 'Кілька слів про неї',
    aboutPlaceholder: 'Для кого, коли, що треба для участі',
    contactLabel: 'Ваш контакт',
    contactHint: 'обовʼязково',
    contactPlaceholder: '@telegram або email',
    contactErr: 'Вкажіть email або нік у Telegram, наприклад @olena. На телефон відповісти не вийде.',
    ads: 'Хочу ознайомитися з рекламними розміщеннями на Dityam.com.ua',
    ageLabel: 'Вік учасників',
    ageFrom: 'від',
    ageTo: 'до',
    whenLabel: 'Коли',
    start: 'Початок',
    end: 'Кінець',
    always: 'Можливість доступна завжди',
    required: 'обовʼязково',
    ageErr: 'Вкажіть вік учасників: від, до або обидва.',
    datesErr: 'Вкажіть дату початку або кінця — або відмітьте «Можливість доступна завжди».',
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
    doneText: 'We’ll check the opportunity and publish it, and write to you when it appears.',
    doneBtn: 'Done',
    formTitle: 'Suggest an opportunity',
    formSub: 'A camp, a course, a contest, a scholarship — anything useful for children 0–18. Publishing is free.',
    nameLabel: 'Name of the opportunity',
    namePlaceholder: 'e.g. Free robotics camp',
    linkLabel: 'Link',
    aboutLabel: 'A few words about it',
    aboutPlaceholder: 'Who it’s for, when, what’s needed to take part',
    contactLabel: 'Your contact',
    contactHint: 'required',
    contactPlaceholder: '@telegram or email',
    contactErr: 'Enter an email or a Telegram username, e.g. @olena. We can’t reply to a phone number.',
    ads: 'I’d like to learn about advertising placements on Dityam.com.ua',
    ageLabel: 'Participants’ age',
    ageFrom: 'from',
    ageTo: 'to',
    whenLabel: 'When',
    start: 'Start',
    end: 'End',
    always: 'Always available',
    required: 'required',
    ageErr: 'Enter the participants’ age: from, to or both.',
    datesErr: 'Enter a start or end date — or tick “Always available”.',
    error: 'Add a name or a link — otherwise there’s nothing for us to check.',
    sending: 'Sending…',
    submit: 'Send',
  },
};

const EMPTY = {
  title: '', url: '', comment: '', contact: '', website: '', ads: false,
  ageFrom: '', ageTo: '', start: '', end: '', always: false,
};

export default function SuggestBlock({ lang = 'uk' } = {}) {
  const t = L[lang] || L.uk;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [form, setForm] = useState(EMPTY);

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
    // Вік і дати (07.10.2026): вік — хоч одна межа, дати — початок або
    // кінець, або «доступна завжди» (lib/suggestExtras.js).
    const problem = extrasProblem(readExtras(form));
    if (problem) {
      setState(problem);
      return;
    }
    // Контакт обовʼязковий (Марія, 07.10.2026): треба знати, хто пише. І лише
    // email або нік у Telegram — на номер телефону ми відповісти не можемо.
    if (!parseContact(form.contact)) {
      setState('contact');
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
      setForm(EMPTY);
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

                <div className="suggest-label">
                  {t.ageLabel} <span className="suggest-opt">{t.required}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="suggest-label" style={{ margin: 0 }}>
                      <input type="number" inputMode="numeric" min={0} max={99} placeholder={t.ageFrom}
                        aria-label={`${t.ageLabel}: ${t.ageFrom}`} value={form.ageFrom} onChange={set('ageFrom')} />
                    </label>
                    <label className="suggest-label" style={{ margin: 0 }}>
                      <input type="number" inputMode="numeric" min={0} max={99} placeholder={t.ageTo}
                        aria-label={`${t.ageLabel}: ${t.ageTo}`} value={form.ageTo} onChange={set('ageTo')} />
                    </label>
                  </div>
                </div>

                <div className="suggest-label">
                  {t.whenLabel} <span className="suggest-opt">{t.required}</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="suggest-label" style={{ margin: 0, fontWeight: 400 }}>
                      <span className="suggest-opt">{t.start}</span>
                      <input type="date" value={form.start} onChange={set('start')} disabled={form.always} />
                    </label>
                    <label className="suggest-label" style={{ margin: 0, fontWeight: 400 }}>
                      <span className="suggest-opt">{t.end}</span>
                      <input type="date" value={form.end} onChange={set('end')} disabled={form.always} />
                    </label>
                  </div>
                </div>

                <label className="v2-check" style={{ marginBottom: 14, fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={form.always}
                    onChange={(e) => setForm((f) => ({ ...f, always: e.target.checked }))}
                  />
                  <span>{t.always}</span>
                </label>

                <label className="suggest-label">
                  {t.aboutLabel}
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
                    required
                  />
                </label>

                {/* Організатори, які приносять можливість, — найтепліші
                    рекламодавці (Марія, 07.10.2026). Знята за замовчуванням. */}
                <label className="v2-check" style={{ marginBottom: 14, fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={form.ads}
                    onChange={(e) => setForm((f) => ({ ...f, ads: e.target.checked }))}
                  />
                  <span>{t.ads}</span>
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

                {['error', 'contact', 'age', 'dates'].includes(state) && (
                  <p className="suggest-error">
                    {{ contact: t.contactErr, age: t.ageErr, dates: t.datesErr }[state] || t.error}
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
