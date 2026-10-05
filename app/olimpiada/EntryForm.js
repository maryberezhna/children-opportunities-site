'use client';

// Заявка на олімпіаду: імʼя дитини для диплома, вік, email батьків → оплата.
// Токен запису лишаємо в браузері: якщо людина закрила вкладку після оплати,
// на цій сторінці зʼявиться «Продовжити» — листів із посиланням ми не шлемо.
import { useEffect, useState } from 'react';

const KEY = 'olimp_entry';
const ERRORS = {
  name: 'Вкажіть імʼя та прізвище дитини — так, як має бути на дипломі.',
  age: 'Оберіть вік дитини.',
  email: 'Перевірте email — на нього ми напишемо, якщо щось піде не так.',
  consent: 'Потрібна ваша згода з правилами.',
  pay: 'Не вдалося відкрити оплату. Спробуйте ще раз за хвилину.',
  unavailable: 'Олімпіада тимчасово недоступна. Спробуйте трохи пізніше.',
  closed: 'Реєстрація ще не відкрита. Старт оголосимо в Telegram-каналі.',
};

export default function EntryForm({ price, ages, open, channelUrl }) {
  const [state, setState] = useState('idle'); // idle | sending | error
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  // До запуску форму бачить лише той, хто прийшов перевіряти: ?preview=1.
  // Справжній замок — на сервері (вхід в адмінку), це лише щоб не плутати людей.
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch { /* приватний режим — просто без «Продовжити» */ }
    setPreview(new URLSearchParams(window.location.search).has('preview'));
  }, []);

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get('name') || ''),
      age: Number(f.get('age')),
      email: String(f.get('email') || ''),
      consent: f.get('consent') === 'on',
      website: String(f.get('website') || ''),
      source: new URLSearchParams(window.location.search).get('utm_source') || '',
    };
    setState('sending');
    setError('');
    try {
      const r = await fetch('/api/olimpiada/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) {
        setState('error');
        setError(ERRORS[j.error] || ERRORS.unavailable);
        return;
      }
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'olimpiada_start', { event_label: 'lohika_9_11', value: price });
      }
      try {
        if (j.t) window.localStorage.setItem(KEY, JSON.stringify({ t: j.t, name: body.name.trim() }));
      } catch { /* без «Продовжити» */ }
      window.location.assign(j.url);
    } catch {
      setState('error');
      setError(ERRORS.unavailable);
    }
  }

  if (!open && !preview) {
    return (
      <div className="ol-form ol-soon">
        <p className="ol-soon-title">Реєстрація відкриється незабаром</p>
        <p className="ol-soon-text">Старт оголосимо в Telegram-каналі Dityam.com.ua — підпишіться, щоб не пропустити.</p>
        <a href={channelUrl} className="ol-btn ol-btn-main ol-btn-wide" target="_blank" rel="noopener">Підписатися на канал</a>
      </div>
    );
  }

  return (
    <form className="ol-form" onSubmit={submit} noValidate>
      {saved?.t && (
        <a className="ol-resume" href={`/olimpiada/test?t=${saved.t}`}>
          Продовжити: тест для {saved.name || 'вашої дитини'} →
        </a>
      )}
      <label className="ol-field">
        <span>Імʼя та прізвище дитини</span>
        <input name="name" type="text" autoComplete="off" maxLength={60} required placeholder="Як на дипломі" />
      </label>
      <label className="ol-field">
        <span>Вік дитини</span>
        <select name="age" required defaultValue="">
          <option value="" disabled>Оберіть</option>
          {ages.map((a) => <option key={a} value={a}>{a} років</option>)}
        </select>
      </label>
      <label className="ol-field">
        <span>Ваш email</span>
        <input name="email" type="email" inputMode="email" autoComplete="email" required placeholder="mama@example.com" />
      </label>
      <label className="ol-hp" aria-hidden="true">
        Сайт
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="ol-check">
        <input name="consent" type="checkbox" required />
        <span>
          Я — мама, тато чи опікун дитини. Погоджуюсь із правилами олімпіади, <a href="/terms" target="_blank" rel="noopener">умовами</a> й{' '}
          <a href="/privacy" target="_blank" rel="noopener">політикою конфіденційності</a>.
        </span>
      </label>
      {error && <p className="ol-error" role="alert">{error}</p>}
      <button type="submit" className="ol-btn ol-btn-main ol-btn-wide" disabled={state === 'sending'}>
        {state === 'sending' ? 'Відкриваємо оплату…' : `Перейти до оплати · ${price} грн`}
      </button>
    </form>
  );
}
