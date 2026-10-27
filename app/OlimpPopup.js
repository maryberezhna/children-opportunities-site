'use client';
import '@/app/styles/olimp-popup.css';
import { useEffect, useRef, useState } from 'react';
import { OLIMP, OLIMP_OPEN, OLIMP_PUBLIC } from '@/lib/olimpiada';
import { sendSiteEvent, SITE_EVENTS } from '@/lib/site-events';
import { trackConversion } from '@/lib/track';
import { MonsterYellow, Star } from './olimpiada/Doodles';
import useOverlaySlot from './useOverlaySlot';

// Попап онлайн-олімпіади на фільтрі (Марія, 06.10.2026: «створи попап на
// сайті, який одразу показує цю можливість, коли хтось вибирає підходящий
// фільтр для дитини»). Коли показувати — вирішує список (OpportunitiesList,
// olimpFilterMatch у lib/olimpiada.js); тут — сам попап і правило «1 раз».
//
// 1 раз на людину: показали — більше не показуємо, навіть якщо закрили не
// дивлячись. Хто вже в списку очікування (olimp_wait, та сама мітка, що на
// /olimpiada), попапу не бачить узагалі.
const SEEN_KEY = 'olimp_popup_seen';
const WAIT_KEY = 'olimp_wait';

const ERRORS = {
  email: 'Перевірте email — на нього прийде лист про старт.',
  consent: 'Потрібна ваша згода, щоб ми могли написати.',
  unavailable: 'Не вдалося зберегти. Спробуйте ще раз за хвилину.',
};

/** Чи можна показати попап цій людині зараз. Позначає «показано». */
export function claimOlimpPopup() {
  if (typeof window === 'undefined') return false;
  if (!(OLIMP_OPEN || OLIMP_PUBLIC)) return false;
  if (window.location.pathname.startsWith('/olimpiada')) return false;
  try {
    if (window.localStorage.getItem(SEEN_KEY) || window.localStorage.getItem(WAIT_KEY)) return false;
    window.localStorage.setItem(SEEN_KEY, new Date().toISOString().slice(0, 10));
  } catch {
    // Сховище недоступне (приватне вікно): без памʼяті попап міг би
    // вилазити на кожен фільтр — краще не показати зовсім.
    return false;
  }
  return true;
}

export default function OlimpPopup({ open: wanted, onClose, place = 'home' }) {
  // Відкривається на фільтр, тобто на дію людини, — у черзі вікон без
  // очікування (lib/overlay-queue.js); лише вибір мови не перебиває.
  const granted = useOverlaySlot('olimp', wanted, { force: true });
  const open = Boolean(wanted) && granted;
  const [state, setState] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const boxRef = useRef(null);
  const acted = useRef(false);

  useEffect(() => {
    if (!open) return undefined;
    acted.current = false;
    sendSiteEvent(SITE_EVENTS.OLIMP_POPUP_SHOW, place);
    trackConversion('olimpiada_popup_show', { event_label: place, event_source: place });
    boxRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // close стабільна в межах показу
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place]);

  if (!open) return null;

  function close() {
    if (!acted.current) sendSiteEvent(SITE_EVENTS.OLIMP_POPUP_CLOSE, place);
    onClose();
  }

  function more() {
    acted.current = true;
    sendSiteEvent(SITE_EVENTS.OLIMP_POPUP_MORE, place);
    trackConversion('olimpiada_popup_more', { event_label: place, event_source: place });
  }

  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      email: String(f.get('email') || ''),
      consent: f.get('consent') === 'on',
      website: String(f.get('website') || ''),
      source: `popup-${place}`,
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
        setError(ERRORS[j.error] || ERRORS.unavailable);
        return;
      }
      acted.current = true;
      trackConversion('olimpiada_waitlist', { event_label: 'lohika_9_11', event_source: `popup-${place}` });
      const clean = body.email.trim().toLowerCase();
      try { window.localStorage.setItem(WAIT_KEY, clean); } catch { /* ок */ }
      setEmail(clean);
      setState('done');
    } catch {
      setState('error');
      setError(ERRORS.unavailable);
    }
  }

  return (
    <div className="olp-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div
        className="olp-box" role="dialog" aria-modal="true" aria-labelledby="olp-title"
        tabIndex={-1} ref={boxRef}
      >
        <button type="button" className="olp-close" onClick={close} aria-label="Закрити">×</button>
        <div className="olp-head">
          <Star className="olp-star" />
          <MonsterYellow className="olp-monster" />
          <span className="olp-pill">Для {OLIMP.groupLabel} · {OLIMP_OPEN ? 'реєстрацію відкрито' : 'скоро старт'}</span>
          <h2 id="olp-title" className="olp-title">Онлайн-олімпіада з логіки</h2>
          <p className="olp-by">від Dityam.com.ua</p>
        </div>

        <div className="olp-body">
          {state === 'done' ? (
            <div role="status">
              <p className="olp-done-title">Дякуємо! Ви в списку</p>
              <p className="olp-text">Щойно відкриємо реєстрацію, напишемо на {email}.</p>
              <a href="/olimpiada" className="olp-btn olp-btn-ghost" onClick={more}>Детальніше про олімпіаду</a>
            </div>
          ) : (
            <>
              <p className="olp-text">
                {OLIMP.questionCount} завдань на кмітливість за {OLIMP.minutes} хвилин, диплом одразу після тесту.{' '}
                {OLIMP_OPEN ? 'Участь безкоштовна.' : 'Реєстрація відкриється незабаром — залиште email, і ми напишемо, щойно стартуємо.'}
              </p>
              {OLIMP_OPEN ? (
                <a href="/olimpiada#uchast" className="olp-btn" onClick={more}>Взяти участь безкоштовно</a>
              ) : (
                <form className="olp-form" onSubmit={submit} noValidate>
                  <label className="olp-field">
                    <span>Ваш email</span>
                    <input name="email" type="email" inputMode="email" autoComplete="email" required placeholder="mama@example.com" />
                  </label>
                  <label className="olp-hp" aria-hidden="true">
                    Сайт
                    <input name="website" type="text" tabIndex={-1} autoComplete="off" />
                  </label>
                  <label className="olp-check">
                    <input name="consent" type="checkbox" required />
                    <span>
                      Погоджуюсь отримати лист про старт олімпіади та з{' '}
                      <a href="/privacy" target="_blank" rel="noopener">політикою конфіденційності</a>.
                    </span>
                  </label>
                  {error && <p className="olp-error" role="alert">{error}</p>}
                  <button type="submit" className="olp-btn" disabled={state === 'sending'}>
                    {state === 'sending' ? 'Зберігаємо…' : 'Повідомити про старт'}
                  </button>
                </form>
              )}
              <a href="/olimpiada" className="olp-more" onClick={more}>Детальніше про олімпіаду →</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
