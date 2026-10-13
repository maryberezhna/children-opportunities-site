'use client';
import '@/app/styles/contact-form.css';
import { useState } from 'react';
import { parseContact } from '@/lib/contactAddress';

// Заявка в амбасадори (/ambasadory). Окрема форма, а не ContactForm: тут є
// роль і місто, яких у загальній формі немає. Шлях той самий — /api/contact
// з типом 'ambassador' → contact_messages → «Звернення» в адмінці. Роль і
// місто дописуємо в текст звернення: окремих колонок під них у таблиці немає.
// Поля й класи — з контактної форми (contact-form.css), щоб форми сайту
// виглядали однаково.

const ROLES = ['Батько чи мати', 'Педагог', 'Інше'];

export function ambassadorMessage({ role, city, about }) {
  return [
    `Роль: ${role}`,
    `Місто чи країна: ${city}`,
    about ? `Про себе: ${about}` : null,
  ].filter(Boolean).join('\n');
}

export default function AmbassadorForm() {
  const [form, setForm] = useState({ name: '', contact: '', city: '', role: '', about: '', website: '' });
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const check = () => {
    if (!form.name.trim()) return 'Напишіть, як вас звати.';
    if (!parseContact(form.contact.trim())) {
      return 'Лишіть email або нік у Telegram, наприклад @olena — так ми зможемо відповісти. На телефон відповісти не вийде.';
    }
    if (!form.city.trim()) return 'Вкажіть місто чи країну.';
    if (!form.role) return 'Оберіть, хто ви: батько чи мати, педагог або інше.';
    return '';
  };

  const submit = async (e) => {
    e.preventDefault();
    const problem = check();
    if (problem) {
      setError(problem);
      setState('error');
      return;
    }
    setState('sending');
    setError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ambassador',
          name: form.name.trim(),
          contact: form.contact.trim(),
          message: ambassadorMessage({ role: form.role, city: form.city.trim(), about: form.about.trim() }),
          publish_consent: consent,
          page: '/ambasadory',
          website: form.website,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || 'failed');
      setState('done');
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'contact_submit', { event_category: 'engagement', event_label: 'ambassador' });
      }
    } catch {
      setError('Не вдалося надіслати. Спробуйте ще раз або напишіть на hellodityam.com.ua@gmail.com.');
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <div className="contact-form-done amb-done" role="status">
        <div className="contact-form-done-icon" aria-hidden="true">🧡</div>
        <h3>Дякуємо, заявка надійшла!</h3>
      </div>
    );
  }

  return (
    <form className="contact-form amb-form" onSubmit={submit} noValidate>
      <div className="contact-row">
        <label className="contact-field">
          <span className="contact-label">Як вас звати <span className="contact-req">обовʼязково</span></span>
          <input className="contact-input" value={form.name} onChange={set('name')} autoComplete="name" maxLength={120} placeholder="Імʼя та прізвище" />
        </label>
        <label className="contact-field">
          <span className="contact-label">Як з вами звʼязатися <span className="contact-req">обовʼязково</span></span>
          <input className="contact-input" value={form.contact} onChange={set('contact')} autoComplete="email" maxLength={120} placeholder="email або @нік у Telegram" />
        </label>
      </div>

      <label className="contact-field">
        <span className="contact-label">Місто чи країна <span className="contact-req">обовʼязково</span></span>
        <input className="contact-input" value={form.city} onChange={set('city')} autoComplete="address-level2" maxLength={120} placeholder="Наприклад, Житомир або Краків" />
      </label>

      <fieldset className="contact-field amb-roles">
        <legend className="contact-label">Хто ви <span className="contact-req">обовʼязково</span></legend>
        <div className="amb-role-list">
          {ROLES.map((r) => (
            <label key={r} className={`amb-role${form.role === r ? ' is-on' : ''}`}>
              <input type="radio" name="role" value={r} checked={form.role === r} onChange={set('role')} />
              {r}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="contact-field">
        <span className="contact-label">Кілька слів про себе</span>
        <textarea
          className="contact-textarea amb-about"
          rows={3}
          maxLength={2000}
          value={form.about}
          onChange={set('about')}
          placeholder="Де плануєте розповідати: чат класу, школа, гурток. За бажанням."
        />
      </label>

      {/* Галочка за замовчуванням знята: дозвіл має бути явною дією людини. */}
      <label className="contact-consent">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>Можна вказати моє імʼя та місто на сторінці амбасадорів Dityam.com.ua. Контакт не публікуємо ніколи.</span>
      </label>

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

      {state === 'error' && error && <p className="contact-error" role="alert">{error}</p>}

      <button type="submit" className="contact-submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Надсилаємо…' : 'Надіслати заявку'}
      </button>

      <p className="contact-privacy">
        Контакт потрібен лише, щоб відповісти вам. Реклами не надсилаємо. Як обробляємо дані — у{' '}
        <a href="/privacy" target="_blank" rel="noopener">політиці конфіденційності</a>.
      </p>
    </form>
  );
}
