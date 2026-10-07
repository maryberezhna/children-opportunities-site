'use client';
import { useEffect, useState, useCallback } from 'react';
import { parseContact } from '@/lib/contactAddress';
import { readExtras, extrasProblem } from '@/lib/suggestExtras';

// Поп-ап «Запропонувати можливість» (редизайн, вересень 2026). Відкривається
// з будь-якого місця сторінки через подію — кнопки живуть і в нижньому блоці
// каталогу, і у футері, а тримати між ними спільний React-стан означало б
// піднімати його аж у серверний layout.

const OPEN_EVENT = 'dityam-suggest-open';
// Пряме посилання на форму: dityam.com.ua/#zaproponuvaty (07.10.2026 — для
// листів організаторам і учасникам SIA: «відкрийте й запропонуйте»).
export const SUGGEST_HASH = '#zaproponuvaty';

export function openSuggest() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function SuggestOpenButton({ children, className }) {
  return (
    <button type="button" className={className} onClick={() => openSuggest()}>
      {children}
    </button>
  );
}

const T = {
  uk: {
    title: 'Запропонувати можливість',
    sub: 'Табір, курс, конкурс, стипендія — будь-що корисне для дітей 0–18. Публікація безкоштовна.',
    name: 'Назва можливості',
    namePh: 'Напр., Безкоштовний табір робототехніки',
    link: 'Посилання',
    note: 'Кілька слів про неї',
    noteOpt: "необов'язково",
    notePh: 'Для кого, коли, що треба для участі',
    contact: 'Ваш контакт',
    contactOpt: 'обовʼязково',
    contactPh: '@telegram або email',
    contactErr: 'Вкажіть email або нік у Telegram, наприклад @olena. На телефон відповісти не вийде.',
    ads: 'Хочу ознайомитися з рекламними розміщеннями на Dityam.com.ua',
    age: 'Вік учасників',
    ageFrom: 'від',
    ageTo: 'до',
    when: 'Коли',
    start: 'Початок',
    end: 'Кінець',
    always: 'Можливість доступна завжди',
    required: 'обовʼязково',
    ageErr: 'Вкажіть вік учасників: від, до або обидва.',
    datesErr: 'Вкажіть дату початку або кінця — або відмітьте «Можливість доступна завжди».',
    send: 'Надіслати',
    sending: 'Надсилаємо…',
    error: 'Не вдалося надіслати. Спробуйте ще раз або напишіть у Telegram.',
    doneTitle: 'Дякуємо!',
    doneText: 'Перевіримо і додамо протягом 1–3 днів.',
    close: 'Закрити',
  },
  en: {
    title: 'Suggest an opportunity',
    sub: 'A camp, course, contest or scholarship — anything useful for children 0–18. Publication is free.',
    name: 'Opportunity name',
    namePh: 'E.g., Free robotics camp',
    link: 'Link',
    note: 'A few words about it',
    noteOpt: 'optional',
    notePh: 'Who it is for, when, what is needed',
    contact: 'Your contact',
    contactOpt: 'required',
    contactPh: '@telegram or email',
    contactErr: 'Enter an email or a Telegram username, e.g. @olena. We can’t reply to a phone number.',
    ads: 'I’d like to learn about advertising placements on Dityam.com.ua',
    age: 'Participants’ age',
    ageFrom: 'from',
    ageTo: 'to',
    when: 'When',
    start: 'Start',
    end: 'End',
    always: 'Always available',
    required: 'required',
    ageErr: 'Enter the participants’ age: from, to or both.',
    datesErr: 'Enter a start or end date — or tick “Always available”.',
    send: 'Send',
    sending: 'Sending…',
    error: 'Could not send. Try again or write on Telegram.',
    doneTitle: 'Thank you!',
    doneText: 'We will review and add it within 1–3 days.',
    close: 'Close',
  },
};

const EMPTY = {
  title: '', url: '', comment: '', contact: '', website: '', ads: false,
  ageFrom: '', ageTo: '', start: '', end: '', always: false,
};

export default function SuggestModal({ lang = 'uk' }) {
  const t = T[lang] || T.uk;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState('idle'); // idle | sending | done | error
  // website — honeypot: людина його не бачить, бот заповнює (той самий
  // трюк, що у старому SuggestBlock, і той самий API).
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    const onOpen = () => { setOpen(true); setState('idle'); };
    const onHash = () => { if (window.location.hash === SUGGEST_HASH) onOpen(); };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Відкрили за посиланням #zaproponuvaty — прибираємо його з адреси, щоб
    // оновлення сторінки не відкривало форму знову.
    if (window.location.hash === SUGGEST_HASH) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.title.trim().length < 5 && !form.url.trim()) {
      setState('error');
      return;
    }
    // Контакт обовʼязковий (Марія, 07.10.2026): треба знати, хто пише. І лише
    // email або нік у Telegram — на номер телефону ми відповісти не можемо.
    // Вік і дати (07.10.2026): вік — хоч одна межа, дати — початок або
    // кінець, або «доступна завжди» (lib/suggestExtras.js).
    const problem = extrasProblem(readExtras(form));
    if (problem) {
      setState(problem);
      return;
    }
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
      setForm(EMPTY);
      if (window.gtag) {
        window.gtag('event', 'suggest_submit', { event_category: 'conversion' });
      }
    } catch {
      setState('error');
    }
  };

  return (
    <div className="v2-overlay" onClick={close}>
      <div
        className="v2-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="v2-dialog-close" aria-label={t.close} onClick={close}>✕</button>

        {state === 'done' ? (
          <div className="v2-dialog-done">
            <span style={{ fontSize: 36 }} aria-hidden="true">🧡</span>
            <h2>{t.doneTitle}</h2>
            <p className="v2-dialog-sub">{t.doneText}</p>
            <button type="button" className="v2-btn-outline" style={{ marginTop: 8 }} onClick={close}>
              {t.close}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2>{t.title}</h2>
              <p className="v2-dialog-sub">{t.sub}</p>
            </div>
            <div className="v2-field">
              <label htmlFor="sg-title">{t.name}</label>
              <input id="sg-title" type="text" placeholder={t.namePh} value={form.title} onChange={set('title')} required />
            </div>
            <div className="v2-field">
              <label htmlFor="sg-url">{t.link}</label>
              <input id="sg-url" type="url" placeholder="https://…" value={form.url} onChange={set('url')} required />
            </div>
            <div className="v2-field">
              <label htmlFor="sg-age-from">{t.age} <span>{t.required}</span></label>
              <div className="v2-field-row">
                <input id="sg-age-from" type="number" inputMode="numeric" min={0} max={99} placeholder={t.ageFrom}
                  aria-label={`${t.age}: ${t.ageFrom}`} value={form.ageFrom} onChange={set('ageFrom')} />
                <input type="number" inputMode="numeric" min={0} max={99} placeholder={t.ageTo}
                  aria-label={`${t.age}: ${t.ageTo}`} value={form.ageTo} onChange={set('ageTo')} />
              </div>
            </div>
            <div className="v2-field">
              <label htmlFor="sg-start">{t.when} <span>{t.required}</span></label>
              <div className="v2-field-row">
                <span className="v2-mini">
                  {t.start}
                  <input id="sg-start" type="date" value={form.start} onChange={set('start')} disabled={form.always} />
                </span>
                <span className="v2-mini">
                  {t.end}
                  <input type="date" aria-label={`${t.when}: ${t.end}`} value={form.end} onChange={set('end')} disabled={form.always} />
                </span>
              </div>
            </div>
            <label className="v2-check">
              <input
                type="checkbox"
                checked={form.always}
                onChange={(e) => setForm((f) => ({ ...f, always: e.target.checked }))}
              />
              <span>{t.always}</span>
            </label>
            <div className="v2-field">
              <label htmlFor="sg-note">{t.note} <span>{t.noteOpt}</span></label>
              <textarea id="sg-note" rows={4} placeholder={t.notePh} value={form.comment} onChange={set('comment')} />
            </div>
            <div className="v2-field">
              <label htmlFor="sg-contact">{t.contact} <span>{t.contactOpt}</span></label>
              <input id="sg-contact" type="text" placeholder={t.contactPh} value={form.contact} onChange={set('contact')} required />
            </div>
            {/* Організатори, які приносять можливість, — найтепліші рекламодавці
                (Марія, 07.10.2026). Галочка знята за замовчуванням: це явне
                бажання людини, а не підписка «за мовчанням». */}
            <label className="v2-check">
              <input
                type="checkbox"
                checked={form.ads}
                onChange={(e) => setForm((f) => ({ ...f, ads: e.target.checked }))}
              />
              <span>{t.ads}</span>
            </label>
            <input
              type="text"
              value={form.website}
              onChange={set('website')}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
            />
            {['error', 'contact', 'age', 'dates'].includes(state) ? (
              <p className="v2-dialog-sub" style={{ color: '#991b1b' }}>
                {{ contact: t.contactErr, age: t.ageErr, dates: t.datesErr }[state] || t.error}
              </p>
            ) : null}
            <button type="submit" className="v2-dialog-submit" disabled={state === 'sending'}>
              {state === 'sending' ? t.sending : t.send}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
