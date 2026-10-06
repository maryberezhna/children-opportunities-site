'use client';

// Проходження тесту: одне завдання на екрані, таймер, перехід між завданнями.
// Час рахує сервер (started_at); браузер лише показує, скільки лишилось, і
// сам здає роботу, коли час вийшов. Відповіді зберігаються в localStorage,
// тож оновлення сторінки чи розряджений телефон їх не стирають.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');

export default function TestRunner({ token, name, started, count, minutes, until }) {
  const [phase, setPhase] = useState(started ? 'loading' : 'intro'); // intro | loading | run | sending | error
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(null);     // секунд до кінця
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const deadlineRef = useRef(null);            // мітка часу за годинником браузера
  const sentRef = useRef(false);
  const storeKey = `olimp_a_${token}`;

  const begin = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const r = await fetch('/api/olimpiada/begin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409 || r.status === 410) { window.location.reload(); return; }
      if (!r.ok || !Array.isArray(j.questions)) throw new Error(j.error || 'bad');
      // Годинник дитини може поспішати чи відставати — рахуємо від серверного «зараз».
      const skew = Date.now() - new Date(j.now).getTime();
      deadlineRef.current = new Date(j.deadline).getTime() + skew;
      let saved = {};
      try { saved = JSON.parse(window.localStorage.getItem(storeKey) || '{}'); } catch { /* з чистого аркуша */ }
      try { window.localStorage.setItem('olimp_entry', JSON.stringify({ t: token, name })); } catch { /* ок */ }
      setAnswers(saved && typeof saved === 'object' ? saved : {});
      setQuestions(j.questions);
      setLeft(Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000)));
      setPhase('run');
    } catch {
      setPhase('error');
      setError('Не вдалося завантажити завдання. Перевірте інтернет і спробуйте ще раз.');
    }
  }, [token, name, storeKey]);

  const submit = useCallback(async (current) => {
    if (sentRef.current) return;
    sentRef.current = true;
    setPhase('sending');
    setConfirm(false);
    try {
      const r = await fetch('/api/olimpiada/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, answers: current }),
      });
      if (r.status === 503) throw new Error('later');
      if (!r.ok) throw new Error('bad');
      try { window.localStorage.removeItem(storeKey); } catch { /* ок */ }
      if (typeof window.gtag === 'function') window.gtag('event', 'olimpiada_finish', { event_label: 'lohika_9_11' });
      setPhase('done');
      window.location.replace(`/olimpiada/test?t=${token}`);
    } catch (e) {
      sentRef.current = false;
      setPhase('run');
      setError(e && e.message === 'later'
        ? 'Сервер тимчасово не приймає відповіді. Вони збережені — зачекай хвилину й натисни «Завершити» ще раз.'
        : 'Не вдалося надіслати відповіді. Перевірте інтернет і натисніть «Завершити» ще раз.');
    }
  }, [token, storeKey]);

  // Актуальні відповіді для таймера — без перезапуску інтервалу на кожен клік.
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Тест уже почато (оновили сторінку) — одразу повертаємо дитину до завдань.
  useEffect(() => { if (started) begin(); }, [started, begin]);

  useEffect(() => {
    if (phase !== 'run') return undefined;
    const tick = () => {
      const s = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) submit(answersRef.current);
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, submit]);

  useEffect(() => {
    if (phase !== 'run') return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [questions, answers],
  );

  function choose(qid, optionId) {
    setAnswers((prev) => {
      const next = { ...prev, [qid]: optionId };
      try { window.localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ок */ }
      return next;
    });
  }

  if (phase === 'done') {
    return (
      <div className="ol-panel ol-intro">
        <p className="ol-kicker">Онлайн-олімпіада з логіки</p>
        <h1 className="ol-h2">Готово! Рахуємо бали й малюємо диплом…</h1>
        <p className="ol-text">Зараз відкриється сторінка з результатом і дипломом.</p>
      </div>
    );
  }

  if (phase === 'intro' || phase === 'error' || phase === 'loading') {
    return (
      <div className="ol-panel ol-intro">
        <p className="ol-kicker">Онлайн-олімпіада з логіки</p>
        <h1 className="ol-h2">{name}, готуємось до старту</h1>
        <ul className="ol-ticks">
          <li>{count} завдань, у кожному 4 варіанти відповіді й 1 правильний</li>
          <li>{minutes} хвилин — час піде, щойно натиснеш «Почати»</li>
          <li>1 спроба: завдання можна гортати вперед і назад та міняти відповідь</li>
          <li>відповідай сам чи сама — так диплом буде справді твоїм</li>
          <li>останнє завдання — відкрите, без таймера: воно вирішує, хто отримає приз місяця</li>
        </ul>
        {until && <p className="ol-deadline">Почати тест треба до {until} за київським часом.</p>}
        {error && <p className="ol-error" role="alert">{error}</p>}
        <button type="button" className="ol-btn ol-btn-main ol-btn-wide" onClick={begin} disabled={phase === 'loading'}>
          {phase === 'loading' ? 'Завантажуємо завдання…' : 'Почати олімпіаду'}
        </button>
        <p className="ol-note">Для батьків: приготуйте тихе місце, папір і олівець. Після тесту диплом зʼявиться одразу.</p>
      </div>
    );
  }

  const q = questions[index];
  const last = index === questions.length - 1;
  const missing = questions.length - answeredCount;
  const low = left !== null && left <= 60;

  return (
    <div className="ol-run">
      <div className="ol-bar">
        <span className="ol-progress">Завдання {index + 1} з {questions.length}</span>
        <span className={`ol-timer${low ? ' is-low' : ''}`} role="timer" aria-live="off">
          {left === null ? '' : `${pad(Math.floor(left / 60))}:${pad(left % 60)}`}
        </span>
      </div>
      <div className="ol-track" aria-hidden="true"><i style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>

      <div className="ol-q">
        {/* Малюнок до умови й варіанти-картинки — SVG, які склав наш сервер
            (content/olimpiada/art.js), тому вставляємо їх як є. */}
        {q.art && <div className="ol-q-art" dangerouslySetInnerHTML={{ __html: q.art }} />}
        <h1 className="ol-q-text">{q.q}</h1>
        <div className={`ol-options${q.options.some((o) => o.art) ? ' is-pics' : ''}${q.options.some((o) => o.art && /viewBox="0 0 2\d\d \d\d"/.test(o.art)) ? ' is-wide' : ''}`} role="radiogroup" aria-label="Варіанти відповіді">
          {q.options.map((o, i) => {
            const on = answers[q.id] === o.id;
            return (
              <button
                key={o.id} type="button" role="radio" aria-checked={on}
                className={`ol-option${on ? ' is-on' : ''}${o.art ? ' is-pic' : ''}`} onClick={() => choose(q.id, o.id)}
                disabled={phase === 'sending'} aria-label={o.text || `Варіант ${i + 1}`}
              >
                {o.art && <span className="ol-option-art" dangerouslySetInnerHTML={{ __html: o.art }} />}
                {o.text && <span>{o.text}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="ol-error" role="alert">{error}</p>}

      <div className="ol-nav">
        <button type="button" className="ol-btn ol-btn-ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0 || phase === 'sending'}>
          ← Назад
        </button>
        {last ? (
          <button type="button" className="ol-btn ol-btn-main" onClick={() => (missing ? setConfirm(true) : submit(answers))} disabled={phase === 'sending'}>
            {phase === 'sending' ? 'Надсилаємо…' : 'Завершити'}
          </button>
        ) : (
          <button type="button" className="ol-btn ol-btn-main" onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={phase === 'sending'}>
            Далі →
          </button>
        )}
      </div>

      <div className="ol-dots" aria-label="Перейти до завдання">
        {questions.map((item, i) => (
          <button
            key={item.id} type="button" aria-label={`Завдання ${i + 1}${answers[item.id] !== undefined ? ', є відповідь' : ''}`}
            className={`ol-dot${i === index ? ' is-here' : ''}${answers[item.id] !== undefined ? ' is-done' : ''}`}
            onClick={() => setIndex(i)} disabled={phase === 'sending'}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {!last && (
        <button type="button" className="ol-finish-link" onClick={() => (missing ? setConfirm(true) : submit(answers))} disabled={phase === 'sending'}>
          Завершити тест зараз
        </button>
      )}

      {confirm && (
        <div className="ol-confirm" role="dialog" aria-modal="true" aria-label="Завершити тест?">
          <div className="ol-confirm-box">
            <h2 className="ol-h2">Завершити тест?</h2>
            <p className="ol-text">Без відповіді лишилось завдань: {missing}. Після завершення змінити відповіді не можна.</p>
            <div className="ol-actions">
              <button type="button" className="ol-btn ol-btn-ghost" onClick={() => setConfirm(false)}>Повернутися до завдань</button>
              <button type="button" className="ol-btn ol-btn-main" onClick={() => submit(answers)}>Завершити</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
