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
export default function SuggestBlock() {
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
        <span className="suggest-kicker">Для організаторів</span>
        <h2>Маєте можливість для дітей?</h2>
        <p>Напишіть нам — перевіримо й опублікуємо в каталозі безкоштовно.</p>
        <button type="button" className="suggest-cta" onClick={openForm}>
          Запропонувати
        </button>
      </section>

      {open ? (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal suggest-modal" role="dialog" aria-modal="true" aria-labelledby="suggest-title">
            <button className="modal-close" onClick={close} aria-label="Закрити">✕</button>

            {state === 'done' ? (
              <div className="suggest-done">
                <div className="modal-icon">💛</div>
                <h2 id="suggest-title">Дякуємо!</h2>
                <p>Ми перевіримо можливість і опублікуємо її в каталозі. Якщо лишили контакт — напишемо, коли вона зʼявиться.</p>
                <button type="button" className="suggest-cta" onClick={close}>Готово</button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h2 id="suggest-title">Запропонувати можливість</h2>
                <p className="suggest-sub">
                  Табір, курс, конкурс, стипендія — будь-що корисне для дітей 0–18.
                  Публікація безкоштовна.
                </p>

                <label className="suggest-label">
                  Назва можливості
                  <input
                    type="text"
                    value={form.title}
                    onChange={set('title')}
                    placeholder="Напр., Безкоштовний табір робототехніки"
                    maxLength={300}
                  />
                </label>

                <label className="suggest-label">
                  Посилання
                  <input
                    type="url"
                    value={form.url}
                    onChange={set('url')}
                    placeholder="https://…"
                    maxLength={500}
                  />
                </label>

                <label className="suggest-label">
                  Кілька слів про неї <span className="suggest-opt">необовʼязково</span>
                  <textarea
                    value={form.comment}
                    onChange={set('comment')}
                    rows={3}
                    placeholder="Для кого, коли, що треба для участі"
                    maxLength={2000}
                  />
                </label>

                <label className="suggest-label">
                  Ваш контакт <span className="suggest-opt">якщо можна щось уточнити</span>
                  <input
                    type="text"
                    value={form.contact}
                    onChange={set('contact')}
                    placeholder="@telegram або email"
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
                    Додайте назву або посилання — інакше нам нема що перевіряти.
                  </p>
                )}

                <button type="submit" className="suggest-cta suggest-submit" disabled={state === 'sending'}>
                  {state === 'sending' ? 'Надсилаємо…' : 'Надіслати'}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
