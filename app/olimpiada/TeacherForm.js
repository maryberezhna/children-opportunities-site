'use client';

// Форма для педагогів на /olimpiada (Марія, 11.10.2026): імʼя та email →
// особисте посилання для учнів одразу тут, у блоці, і листом. Той самий email
// удруге — те саме посилання (сервер нового не заводить і листа не шле).
import { useState } from 'react';
import { teacherPagePath } from '@/lib/olimpiada';
import { sendSiteEvent, SITE_EVENTS } from '@/lib/site-events';
import { trackConversion } from '@/lib/track';
import TeacherShare from './TeacherShare';

const ERRORS = {
  name: 'Вкажіть імʼя та прізвище — так, як має бути на подяці.',
  email: 'Перевірте email — на нього надішлемо посилання й подяку.',
  consent: 'Потрібна ваша згода, щоб ми могли написати.',
  unavailable: 'Не вдалося зберегти. Спробуйте ще раз за хвилину.',
};

export default function TeacherForm() {
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');
  const [res, setRes] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get('name') || ''),
      email: String(f.get('email') || ''),
      consent: f.get('consent') === 'on',
      website: String(f.get('website') || ''),
      source: new URLSearchParams(window.location.search).get('utm_source') || 'page',
    };
    setState('sending');
    setError('');
    try {
      const r = await fetch('/api/olimpiada/teacher', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.code) {
        setState('error');
        setError(ERRORS[j.error] || ERRORS.unavailable);
        return;
      }
      // Новий педагог — у власні лічильники й GA4; повторний email — ні.
      if (!j.already) {
        sendSiteEvent(SITE_EVENTS.OLIMP_TEACHER_SIGNUP, body.source);
        trackConversion('olimpiada_teacher_signup', { event_label: body.source, event_source: body.source });
      }
      setRes({ ...j, email: body.email.trim().toLowerCase() });
      setState('done');
    } catch {
      setState('error');
      setError(ERRORS.unavailable);
    }
  }

  if (state === 'done' && res) {
    return (
      <div className="ol-form ol-teach-form" role="status">
        <p className="ol-ok">
          {res.already
            ? 'Цей email уже зареєстровано — ось ваше посилання.'
            : `Готово! Ось ваше особисте посилання для учнів${res.mailed ? ` — його ми надіслали й на ${res.email}` : ''}.`}
        </p>
        <TeacherShare code={res.code} />
        <p className="ol-teach-hint">
          На сторінці педагога — готовий текст для чату класу, кількість учнів, які пройшли олімпіаду за вашим посиланням, і подяка.
        </p>
        <a className="ol-btn ol-btn-ghost" href={teacherPagePath(res.code)}>Відкрити сторінку педагога</a>
      </div>
    );
  }

  return (
    <form className="ol-form ol-teach-form" onSubmit={submit} noValidate>
      <label className="ol-field">
        <span>Імʼя та прізвище</span>
        <input name="name" type="text" autoComplete="name" maxLength={60} required placeholder="Олена Петрівна Коваль" />
      </label>
      <label className="ol-field">
        <span>Email</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" required placeholder="olena@example.com" />
      </label>
      <label className="ol-hp" aria-hidden="true">
        Сайт
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="ol-check">
        <input name="consent" type="checkbox" required />
        <span>
          Погоджуюсь отримати лист із посиланням і подякою та з{' '}
          <a href="/privacy" target="_blank" rel="noopener">політикою конфіденційності</a>.
        </span>
      </label>
      {error && <p className="ol-error" role="alert">{error}</p>}
      <button type="submit" className="ol-btn ol-btn-main" disabled={state === 'sending'}>
        {state === 'sending' ? 'Зберігаємо…' : 'Отримати посилання'}
      </button>
    </form>
  );
}
