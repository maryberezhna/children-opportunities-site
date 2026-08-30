'use client';
import { useState } from 'react';
import { CONTACT_TYPES, CONTACT_TYPE_MAP } from '@/lib/contactTypes';

/**
 * Контактна форма з вибором типу звернення. Тип визначає підказку і
 * плейсхолдер — людина одразу бачить, що саме варто написати, а адмінка
 * отримує розсортовану пошту замість купи «просто листів».
 */
const L = {
  uk: {
    doneTitle: 'Дякуємо, лист надійшов!',
    doneText: 'Ми читаємо все і відповідаємо, якщо ви лишили контакт. Пропозиції можливостей зазвичай зʼявляються на сайті протягом кількох днів.',
    again: 'Написати ще раз',
    topic: 'Тема звернення',
    message: 'Повідомлення',
    required: 'обовʼязково',
    link: 'Посилання',
    name: 'Як вас звати',
    namePlaceholder: "Ім'я",
    contact: 'Email або телефон',
    contactPlaceholder: 'щоб ми могли відповісти',
    errShort: 'Напишіть, будь ласка, хоча б кілька слів — так ми зрозуміємо, чим допомогти.',
    errContact: 'Лишіть email або телефон — без них ми не зможемо відповісти.',
    errSend: 'Не вдалося надіслати. Спробуйте ще раз або напишіть на maryberezhna@gmail.com.',
    sending: 'Надсилаємо…',
    submit: 'Надіслати',
    privacy: 'Ми не передаємо ваші контакти третім сторонам і не надсилаємо реклами.',
  },
  en: {
    doneTitle: 'Thank you, your message arrived!',
    doneText: 'We read everything and reply if you left a contact. Suggested opportunities usually appear on the site within a few days.',
    again: 'Write again',
    topic: 'What is it about',
    message: 'Message',
    required: 'required',
    link: 'Link',
    name: 'Your name',
    namePlaceholder: 'Name',
    contact: 'Email or phone',
    contactPlaceholder: 'so we can reply',
    errShort: 'Please write at least a few words, so we understand how to help.',
    errContact: 'Leave an email or a phone number — without one we can’t reply.',
    errSend: 'Could not send. Please try again, or write to maryberezhna@gmail.com.',
    sending: 'Sending…',
    submit: 'Send',
    privacy: 'We don’t pass your contacts to third parties and we don’t send advertising.',
  },
};

export default function ContactForm({ lang = 'uk' }) {
  const t = L[lang] || L.uk;
  const isEn = lang === 'en';
  const [type, setType] = useState('opportunity');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [form, setForm] = useState({ message: '', name: '', contact: '', url: '', website: '' });

  const active = CONTACT_TYPE_MAP[type];
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Контакт обовʼязковий: анонімні звернення — це або спам, або лист, на який
  // фізично не можна відповісти. Перевірка навмисно м'яка: пошта або будь-що
  // з 7+ цифрами (телефон у будь-якому форматі, з пробілами й дужками).
  const contactOk = (v) => /\S+@\S+\.\S+/.test(v) || (v.replace(/\D/g, '').length >= 7);

  const submit = async (e) => {
    e.preventDefault();
    if (form.message.trim().length < 10 || !contactOk(form.contact.trim())) {
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
        <h3>{t.doneTitle}</h3>
        <p>{t.doneText}</p>
        <button type="button" className="contact-form-again" onClick={() => setState('idle')}>
          {t.again}
        </button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <label className="contact-field">
        <span className="contact-label">{t.topic}</span>
        <select
          className="contact-select"
          value={type}
          onChange={(e) => { setType(e.target.value); setState('idle'); }}
        >
          {CONTACT_TYPES.map((o) => (
            <option key={o.value} value={o.value}>{o.emoji} {(isEn && o.labelEn) || o.label}</option>
          ))}
        </select>
      </label>

      <p className="contact-hint">{(isEn && active.hintEn) || active.hint}</p>

      <label className="contact-field">
        <span className="contact-label">
          {t.message} <span className="contact-req">{t.required}</span>
        </span>
        <textarea
          className="contact-textarea"
          rows={6}
          required
          minLength={10}
          value={form.message}
          onChange={set('message')}
          placeholder={(isEn && active.placeholderEn) || active.placeholder}
        />
      </label>

      {(type === 'opportunity' || type === 'error') && (
        <label className="contact-field">
          <span className="contact-label">{t.link}</span>
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
          <span className="contact-label">{t.name}</span>
          <input className="contact-input" value={form.name} onChange={set('name')} placeholder={t.namePlaceholder} />
        </label>
        <label className="contact-field">
          <span className="contact-label">
            {t.contact} <span className="contact-req">{t.required}</span>
          </span>
          <input
            className="contact-input"
            required
            value={form.contact}
            onChange={set('contact')}
            placeholder={t.contactPlaceholder}
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
            ? t.errShort
            : !contactOk(form.contact.trim())
              ? t.errContact
              : t.errSend}
        </p>
      )}

      <button type="submit" className="contact-submit" disabled={state === 'sending'}>
        {state === 'sending' ? t.sending : t.submit}
      </button>

      <p className="contact-privacy">
        {t.privacy}
      </p>
    </form>
  );
}
