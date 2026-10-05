'use client';

// «Стати партнером» на /stem-talant: кнопка одразу відкриває спливне вікно
// з короткою формою (Марія, 05.10.2026: «щоб було просто і зрозуміло»).
// Заявка йде тим самим шляхом, що й контактна форма сайту: /api/contact,
// тип 'partnership' → таблиця contact_messages і повідомлення в адмін-бот.

import { useRef, useState } from 'react';

const NOMINATIONS = ['Програмування й ШІ', 'Робототехніка й інженерія', 'Наука й математика'];
const FORMATS = ['Генеральний партнер', 'Партнер номінації', 'Ще не знаю — розкажіть більше'];

export default function PartnerModal({ label = 'Стати партнером', className = '' }) {
  const dialogRef = useRef(null);
  const [format, setFormat] = useState(FORMATS[0]);
  const [state, setState] = useState('idle'); // idle | sending | sent | error | contact

  const open = () => {
    setState('idle');
    dialogRef.current?.showModal();
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'partner_form_open', { event_label: 'stem_talant' });
    }
  };
  const close = () => dialogRef.current?.close();

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const company = String(f.get('company') || '').trim();
    const nomination = format === 'Партнер номінації' ? String(f.get('nomination') || '') : '';
    const note = String(f.get('note') || '').trim();
    const message = [
      'STEM-талант України — заявка на партнерство',
      `Компанія: ${company}`,
      `Формат: ${format}`,
      nomination ? `Номінація: ${nomination}` : null,
      note ? `Коментар: ${note}` : null,
    ].filter(Boolean).join('\n');

    setState('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'partnership',
          name: String(f.get('name') || '').trim(),
          contact: String(f.get('contact') || '').trim(),
          message,
          page: '/stem-talant',
          website: String(f.get('website') || ''),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.ok) {
        setState('sent');
        if (window.gtag) window.gtag('event', 'partner_form_submit', { event_label: format });
      } else {
        setState(json.error === 'contact' ? 'contact' : 'error');
      }
    } catch {
      setState('error');
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={open}>{label}</button>
      <dialog ref={dialogRef} className="st-modal" aria-labelledby="st-modal-title"
        onClick={(e) => { if (e.target === dialogRef.current) close(); }}>
        <div className="st-modal-box">
          <button type="button" className="st-modal-x" onClick={close} aria-label="Закрити">×</button>
          {state === 'sent' ? (
            <div className="st-modal-done">
              <p className="st-modal-emoji" aria-hidden="true">🤝</p>
              <h2 id="st-modal-title">Дякуємо!</h2>
              <p>Заявку отримано. Відповімо на вказаний email чи телефон.</p>
              <button type="button" className="st-btn st-btn-yellow" onClick={close}>Закрити</button>
            </div>
          ) : (
            <form onSubmit={submit} className="st-form">
              <h2 id="st-modal-title">Стати партнером</h2>
              <p className="st-form-sub">«STEM-талант України» · для IT-компаній</p>

              <label className="st-field">
                <span>Компанія</span>
                <input name="company" required maxLength={120} autoComplete="organization" />
              </label>
              <label className="st-field">
                <span>Ваше імʼя</span>
                <input name="name" required maxLength={120} autoComplete="name" />
              </label>
              <label className="st-field">
                <span>Email або телефон</span>
                <input name="contact" required maxLength={120} autoComplete="email" />
              </label>

              <fieldset className="st-field st-choice">
                <legend>Формат</legend>
                <div className="st-chips">
                  {FORMATS.map((x) => (
                    <label key={x} className={format === x ? 'is-on' : ''}>
                      <input type="radio" name="format" value={x} checked={format === x} onChange={() => setFormat(x)} />
                      {x}
                    </label>
                  ))}
                </div>
              </fieldset>

              {format === 'Партнер номінації' && (
                <label className="st-field">
                  <span>Номінація</span>
                  <select name="nomination" defaultValue={NOMINATIONS[0]}>
                    {NOMINATIONS.map((n) => <option key={n}>{n}</option>)}
                  </select>
                </label>
              )}

              <label className="st-field">
                <span>Коментар <i>(необовʼязково)</i></span>
                <textarea name="note" rows={3} maxLength={1500} />
              </label>

              {/* Пастка для ботів — людина її не бачить. */}
              <input name="website" tabIndex={-1} autoComplete="off" className="st-hp" aria-hidden="true" />

              {state === 'contact' && <p className="st-form-err">Перевірте email або телефон — нам потрібен контакт, щоб відповісти.</p>}
              {state === 'error' && <p className="st-form-err">Не вдалося надіслати. Спробуйте ще раз або напишіть на hellodityam.com.ua@gmail.com.</p>}

              <button type="submit" className="st-btn st-btn-yellow st-form-send" disabled={state === 'sending'}>
                {state === 'sending' ? 'Надсилаємо…' : 'Надіслати заявку'}
              </button>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
