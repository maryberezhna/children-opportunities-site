'use client';
import { useState } from 'react';
import { CONTACT_TYPES, CONTACT_TYPE_MAP } from '@/lib/contactTypes';

/**
 * Контактна форма з вибором типу звернення. Тип визначає підказку і
 * плейсхолдер — людина одразу бачить, що саме варто написати, а адмінка
 * отримує розсортовану пошту замість купи «просто листів».
 */
export default function ContactForm() {
  const [type, setType] = useState('opportunity');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [form, setForm] = useState({ message: '', name: '', contact: '', url: '', website: '' });

  const active = CONTACT_TYPE_MAP[type];
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.message.trim().length < 10) {
      setState('error');
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          type,
          page: typeof window !== 'undefined' ? window.location.pathname : '',
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error('failed');
      setState('done');
      setForm({ message: '', name: '', contact: '', url: '', website: '' });
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'contact_submit', { event_category: 'engagement', event_label: type });
      }
    } catch (err) {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className="contact-form-done">
        <div className="contact-form-done-icon">🧡</div>
        <h3>Дякуємо, лист надійшов!</h3>
        <p>
          Ми читаємо все і відповідаємо, якщо ви лишили контакт.
          Пропозиції можливостей зазвичай зʼявляються в каталозі протягом кількох днів.
        </p>
        <button type="button" className="contact-form-again" onClick={() => setState('idle')}>
          Написати ще раз
        </button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <label className="contact-field">
        <span className="contact-label">Тема звернення</span>
        <select
          className="contact-select"
          value={type}
          onChange={(e) => { setType(e.target.value); setState('idle'); }}
        >
          {CONTACT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>
          ))}
        </select>
      </label>

      <p className="contact-hint">{active.hint}</p>

      <label className="contact-field">
        <span className="contact-label">
          Повідомлення <span className="contact-req">обовʼязково</span>
        </span>
        <textarea
          className="contact-textarea"
          rows={6}
          required
          minLength={10}
          value={form.message}
          onChange={set('message')}
          placeholder={active.placeholder}
        />
      </label>

      {(type === 'opportunity' || type === 'error') && (
        <label className="contact-field">
          <span className="contact-label">Посилання</span>
          <input
            className="contact-input"
            type="url"
            inputMode="url"
            value={form.url}
            onChange={set('url')}
            placeholder="https://..."
          />
        </label>
      )}

      <div className="contact-row">
        <label className="contact-field">
          <span className="contact-label">Як вас звати</span>
          <input className="contact-input" value={form.name} onChange={set('name')} placeholder="Ім'я" />
        </label>
        <label className="contact-field">
          <span className="contact-label">Email або телефон</span>
          <input
            className="contact-input"
            value={form.contact}
            onChange={set('contact')}
            placeholder="щоб ми могли відповісти"
          />
        </label>
      </div>

      {/* honeypot: приховане поле для ботів */}
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={set('website')}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />

      {state === 'error' && (
        <p className="contact-error">
          {form.message.trim().length < 10
            ? 'Напишіть, будь ласка, хоча б кілька слів — так ми зрозуміємо, чим допомогти.'
            : 'Не вдалося надіслати. Спробуйте ще раз або напишіть на maryberezhna@gmail.com.'}
        </p>
      )}

      <button type="submit" className="contact-submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Надсилаємо…' : 'Надіслати'}
      </button>

      <p className="contact-privacy">
        Ми не передаємо ваші контакти третім сторонам і не надсилаємо реклами.
      </p>
    </form>
  );
}
