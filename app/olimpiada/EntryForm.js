'use client';

// Заявка на олімпіаду: імʼя дитини для диплома й email батьків → одразу тест.
// З 08.10.2026 участь безкоштовна — оплати в заявці немає; друкований диплом
// замовляють після тесту, на сторінці результату.
// Віку не питаємо (Марія, 06.10.2026: «навіщо нам вік»): він ні на що не
// впливав — ні на диплом, ні на подарунок Dityam+; група 9–11 названа на сторінці.
// Токен запису лишаємо в браузері: якщо людина закрила вкладку після оплати,
// на цій сторінці зʼявиться «Продовжити» — листів із посиланням ми не шлемо.
import { useEffect, useState } from 'react';
import { validTeacherCode } from '@/lib/olimpiada';
import { useEmailTypo } from './EmailTypoHint';

const KEY = 'olimp_entry';
// Посилання педагога /olimpiada?vid=<код> (11.10.2026). Код запамʼятовуємо:
// батьки часто відкривають посилання з чату класу, а заявку подають пізніше
// або після переходів сайтом, коли ?vid в адресі вже немає. 60 днів — щоб
// давнє посилання не приписало педагогові зовсім іншу заявку.
const TEACHER_KEY = 'olimp_teacher_ref';
const TEACHER_TTL = 60 * 24 * 60 * 60 * 1000;

function teacherRef() {
  const fromUrl = new URLSearchParams(window.location.search).get('vid');
  if (validTeacherCode(fromUrl)) return fromUrl;
  try {
    const v = JSON.parse(window.localStorage.getItem(TEACHER_KEY) || 'null');
    if (v && validTeacherCode(v.c) && Date.now() - Number(v.at) < TEACHER_TTL) return v.c;
  } catch { /* приватний режим — лише з адреси */ }
  return '';
}
const WAIT_KEY = 'olimp_wait';
const ERRORS = {
  name: 'Вкажіть імʼя та прізвище дитини — так, як має бути на дипломі.',
  email: 'Перевірте email — на нього ми напишемо, якщо щось піде не так.',
  consent: 'Потрібна ваша згода з правилами.',
  too_many: 'На цю пошту сьогодні вже забагато заявок. Спробуйте завтра або напишіть нам.',
  unavailable: 'Олімпіада тимчасово недоступна. Спробуйте трохи пізніше.',
  closed: 'Реєстрація ще не відкрита. Старт оголосимо в Telegram-каналі.',
};

export default function EntryForm({ open, channelUrl }) {
  const [state, setState] = useState('idle'); // idle | sending | error
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  // До запуску форму бачить лише той, хто прийшов перевіряти: ?preview=1.
  // Справжній замок — на сервері (вхід в адмінку), це лише щоб не плутати людей.
  const [preview, setPreview] = useState(false);
  const typo = useEmailTypo('entry');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch { /* приватний режим — просто без «Продовжити» */ }
    const query = new URLSearchParams(window.location.search);
    setPreview(query.has('preview'));
    const vid = query.get('vid');
    if (validTeacherCode(vid)) {
      try { window.localStorage.setItem(TEACHER_KEY, JSON.stringify({ c: vid, at: Date.now() })); } catch { /* ок */ }
    }
  }, []);

  async function submit(e) {
    e.preventDefault();
    // Схоже на помилку в домені (gmai.com) — спершу підказка, удруге пропускаємо.
    if (typo.blockSubmit()) return;
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get('name') || ''),
      email: String(f.get('email') || ''),
      consent: f.get('consent') === 'on',
      website: String(f.get('website') || ''),
      source: new URLSearchParams(window.location.search).get('utm_source') || '',
      // Код педагога: сервер перевірить, що такий педагог є, інакше пропустить.
      teacher: teacherRef(),
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
        window.gtag('event', 'olimpiada_start', { event_label: 'lohika_9_11' });
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

  if (!open && !preview) return <Waitlist channelUrl={channelUrl} />;

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
      <div className="ol-email">
        <label className="ol-field">
          <span>Ваш email</span>
          <input name="email" type="email" inputMode="email" autoComplete="email" required placeholder="mama@example.com" {...typo.inputProps} />
        </label>
        {typo.hintNode}
      </div>
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
        {state === 'sending' ? 'Відкриваємо…' : 'Взяти участь безкоштовно'}
      </button>
    </form>
  );
}

// До старту — список очікування: email і 1 лист, щойно відкриємо реєстрацію
// (Марія, 06.10.2026: «починай збирати імейли кому цікаво»).
const WAIT_ERRORS = {
  email: 'Перевірте email — на нього прийде лист про старт.',
  consent: 'Потрібна ваша згода, щоб ми могли написати.',
  unavailable: 'Не вдалося зберегти. Спробуйте ще раз за хвилину.',
};

function Waitlist({ channelUrl }) {
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const typo = useEmailTypo('waitlist');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WAIT_KEY);
      if (saved) { setEmail(saved); setState('done'); }
    } catch { /* приватний режим */ }
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (typo.blockSubmit()) return;
    const f = new FormData(e.currentTarget);
    const body = {
      email: String(f.get('email') || ''),
      consent: f.get('consent') === 'on',
      website: String(f.get('website') || ''),
      // Звідки email: utm з каналу чи листа, інакше — сама сторінка (попап на
      // фільтрі пише своє 'popup-…'), щоб в адмінці було видно, що спрацювало.
      source: new URLSearchParams(window.location.search).get('utm_source') || 'page',
    };
    setState('sending');
    setError('');
    try {
      const r = await fetch('/api/olimpiada/waitlist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setState('error');
        setError(WAIT_ERRORS[j.error] || WAIT_ERRORS.unavailable);
        return;
      }
      if (typeof window.gtag === 'function') window.gtag('event', 'olimpiada_waitlist', { event_label: 'lohika_9_11' });
      const clean = body.email.trim().toLowerCase();
      try { window.localStorage.setItem(WAIT_KEY, clean); } catch { /* ок */ }
      setEmail(clean);
      setState('done');
    } catch {
      setState('error');
      setError(WAIT_ERRORS.unavailable);
    }
  }

  if (state === 'done') {
    return (
      <div className="ol-form ol-soon" role="status">
        <p className="ol-soon-title">Дякуємо! Ви в списку</p>
        <p className="ol-soon-text">Щойно відкриємо реєстрацію, напишемо {email ? `на ${email}` : 'вам'}.</p>
        <a href={channelUrl} className="ol-btn ol-btn-ghost ol-btn-wide" target="_blank" rel="noopener">Telegram-канал Dityam.com.ua</a>
      </div>
    );
  }

  return (
    <form className="ol-form ol-soon" onSubmit={submit} noValidate>
      <p className="ol-soon-title">Реєстрація відкриється незабаром</p>
      <p className="ol-soon-text">Залиште email — напишемо 1 лист, щойно олімпіада стартує.</p>
      <div className="ol-email">
        <label className="ol-field">
          <span>Ваш email</span>
          <input name="email" type="email" inputMode="email" autoComplete="email" required placeholder="mama@example.com" {...typo.inputProps} />
        </label>
        {typo.hintNode}
      </div>
      <label className="ol-hp" aria-hidden="true">
        Сайт
        <input name="website" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="ol-check">
        <input name="consent" type="checkbox" required />
        <span>
          Погоджуюсь отримати лист про старт олімпіади та з{' '}
          <a href="/privacy" target="_blank" rel="noopener">політикою конфіденційності</a>.
        </span>
      </label>
      {error && <p className="ol-error" role="alert">{error}</p>}
      <button type="submit" className="ol-btn ol-btn-main ol-btn-wide" disabled={state === 'sending'}>
        {state === 'sending' ? 'Зберігаємо…' : 'Повідомити про старт'}
      </button>
    </form>
  );
}
