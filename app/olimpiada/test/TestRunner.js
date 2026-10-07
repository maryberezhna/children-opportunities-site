'use client';

// Проходження тесту: одне завдання на екрані, таймер, перехід між завданнями.
// Час рахує сервер (started_at); браузер лише показує, скільки лишилось.
// Хвилини — лише на завдання з варіантами: коли дитина їх завершує або час
// вийшов, відповіді відправляються, і настає останній крок — відкрите
// завдання БЕЗ таймера (Марія, 07.10.2026: «без таймера»; до того воно було в
// тих самих хвилинах плюс 2 хвилини табло). Воно й далі перед дипломом, а не
// після нього (06.10.2026). Відповіді й чернетка відкритого завдання — у
// localStorage, тож оновлення сторінки чи розряджений телефон їх не стирають.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');
const clock = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

export default function TestRunner({ token, name, started, count, minutes, openTask, openArt, until, email, invited }) {
  const [phase, setPhase] = useState(started ? 'loading' : 'intro'); // intro | loading | run | sending | open | done | error
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [openText, setOpenText] = useState('');
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(null);      // секунд до кінця часу на завдання з варіантами
  const [timeUp, setTimeUp] = useState(false);
  const [openSending, setOpenSending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const deadlineRef = useRef(null);            // мітка часу за годинником браузера
  const sentRef = useRef(false);
  const autoRef = useRef(false);             // час вийшов — здаємо сам лише 1 раз
  const storeKey = `olimp_a_${token}`;
  const openKey = `olimp_o_${token}`;
  const resultUrl = `/olimpiada/test?t=${token}`;

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
      try { setOpenText(window.localStorage.getItem(openKey) || ''); } catch { /* без чернетки */ }
      try { window.localStorage.setItem('olimp_entry', JSON.stringify({ t: token, name })); } catch { /* ок */ }
      setAnswers(saved && typeof saved === 'object' ? saved : {});
      setQuestions(j.questions);
      const s = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setLeft(s);
      setPhase('run');
    } catch {
      setPhase('error');
      setError('Не вдалося завантажити завдання. Перевірте інтернет і спробуйте ще раз.');
    }
  }, [token, name, storeKey, openKey]);

  // Здача завдань із варіантами. Далі — відкрите завдання, без таймера.
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
      setError('');
      setPhase('open');
    } catch (e) {
      sentRef.current = false;
      setPhase('run');
      setError(e && e.message === 'later'
        ? 'Сервер тимчасово не приймає відповіді. Вони збережені — зачекай хвилину й натисни кнопку ще раз.'
        : 'Не вдалося надіслати відповіді. Перевірте інтернет і натисніть кнопку ще раз.');
    }
  }, [token, storeKey]);

  // Відкрите завдання — окремо й без поспіху. «Пропустити» теж веде до диплома.
  const sendOpen = useCallback(async () => {
    if (openSending) return;
    setOpenSending(true);
    setError('');
    try {
      const r = await fetch('/api/olimpiada/open', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, open: openText }),
      });
      if (!r.ok) throw new Error('bad');
      try { window.localStorage.removeItem(openKey); } catch { /* ок */ }
      setPhase('done');
      window.location.replace(resultUrl);
    } catch {
      setOpenSending(false);
      setError('Не вдалося надіслати відповідь. Вона збережена — перевірте інтернет і натисніть кнопку ще раз.');
    }
  }, [openSending, token, openText, openKey, resultUrl]);
  const skipOpen = () => { setPhase('done'); window.location.replace(resultUrl); };

  // Актуальні відповіді для таймера — без перезапуску інтервалу на кожен клік.
  const answersRef = useRef(answers);
  useEffect(() => { answersRef.current = answers; }, [answers]);

  // Тест уже почато (оновили сторінку) — одразу повертаємо дитину до завдань.
  useEffect(() => { if (started) begin(); }, [started, begin]);

  useEffect(() => {
    if (phase !== 'run') return undefined;
    const tick = () => {
      const ms = deadlineRef.current - Date.now();
      setLeft(Math.max(0, Math.round(ms / 1000)));
      if (ms > 0) return;
      // Час на завдання з варіантами вийшов — здаємо їх самі, і далі
      // відкрите завдання, вже без таймера.
      setTimeUp(true);
      if (!autoRef.current) {
        autoRef.current = true;
        submit(answersRef.current);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, submit]);

  // Попередження при закритті вкладки — і під час завдань, і на відкритому.
  const guard = phase === 'run' || phase === 'open';
  useEffect(() => {
    if (!guard) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [guard]);

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [questions, answers],
  );

  function choose(qid, optionId) {
    if (timeUp) return;
    setAnswers((prev) => {
      const next = { ...prev, [qid]: optionId };
      try { window.localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* ок */ }
      return next;
    });
  }

  function writeOpen(value) {
    setOpenText(value);
    try { window.localStorage.setItem(openKey, value); } catch { /* ок */ }
  }

  const openField = (
    <>
      <label className="ol-field">
        <span>Твоє питання й відповідь</span>
        <textarea
          value={openText} onChange={(e) => writeOpen(e.target.value)} maxLength={openTask.maxLength} rows={8}
          placeholder="Питання… Відповідь… Як до неї дійти…" disabled={openSending}
        />
      </label>
      <p className="ol-count">{openText.length} / {openTask.maxLength}</p>
    </>
  );

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
          <li>{minutes} хвилин на завдання з варіантами — час піде, щойно натиснеш «Почати»; коли вийде, відповіді відправляться самі</li>
          <li>останнє завдання — відкрите: без варіантів і без таймера, відповідь пишеш сам чи сама</li>
          <li>1 спроба: завдання можна гортати вперед і назад та міняти відповідь</li>
          <li>відповідай сам чи сама — так диплом буде справді твоїм</li>
        </ul>
        {until && <p className="ol-deadline">Почати тест треба до {until} за київським часом.</p>}
        {/* Посилання на цю сторінку — єдиний вхід до тесту: кажемо, де воно є
            ще, якщо вкладку закриють (07.10.2026). */}
        {until && email && (
          <p className="ol-note">
            {invited
              ? `Посилання на цю сторінку ми надіслали на ${email}. Листа немає у «Вхідних» — перегляньте «Спам» і «Промоакції».`
              : `Посилання на цю сторінку надішлемо й на ${email}. А поки — збережіть його в закладки.`}
          </p>
        )}
        {error && <p className="ol-error" role="alert">{error}</p>}
        <button type="button" className="ol-btn ol-btn-main ol-btn-wide" onClick={begin} disabled={phase === 'loading'}>
          {phase === 'loading' ? 'Завантажуємо завдання…' : 'Почати олімпіаду'}
        </button>
        <p className="ol-note">Для батьків: приготуйте тихе місце, папір і олівець. Після тесту диплом зʼявиться одразу.</p>
      </div>
    );
  }

  // Останній крок — відкрите завдання, без таймера (07.10.2026).
  if (phase === 'open') {
    return (
      <div className="ol-panel ol-open-step">
        <p className="ol-kicker">Останнє завдання · відкрите · без таймера</p>
        <h1 className="ol-q-text">{openTask.title}</h1>
        <p className="ol-note">Відповіді на завдання з варіантами прийнято. Тут час не рахується — подумай спокійно.</p>
        {/* Малюнок склав наш сервер (content/olimpiada/open-task-art.js). */}
        {openArt && <div className="ol-q-art" dangerouslySetInnerHTML={{ __html: openArt }} />}
        <p className="ol-text">{openTask.text}</p>
        {/* Без примітки про приз і журі (Марія, 06.10.2026: «це трохи тисне у
            тесті») — умови конкурсу дитина й батьки бачать на сторінці. */}
        {openField}
        {error && <p className="ol-error" role="alert">{error}</p>}
        <div className="ol-nav">
          <button type="button" className="ol-btn ol-btn-ghost" onClick={skipOpen} disabled={openSending}>
            Пропустити
          </button>
          <button type="button" className="ol-btn ol-btn-main" onClick={sendOpen} disabled={openSending || !openText.trim()}>
            {openSending ? 'Надсилаємо…' : 'Відправити відповідь'}
          </button>
        </div>
      </div>
    );
  }

  // Час на завдання з варіантами вийшов — відправляємо їх (далі відкрите завдання).
  if (timeUp) {
    return (
      <div className="ol-panel ol-intro" role="status">
        <p className="ol-kicker">Час на завдання вийшов</p>
        <h1 className="ol-h2">{phase === 'sending' ? 'Відправляємо відповіді…' : 'Відповіді не відправились'}</h1>
        <p className="ol-text">Далі — останнє, відкрите завдання. На нього таймера немає.</p>
        {error && <p className="ol-error" role="alert">{error}</p>}
        {phase !== 'sending' && (
          <button type="button" className="ol-btn ol-btn-main ol-btn-wide" onClick={() => submit(answers)}>
            Відправити відповіді
          </button>
        )}
      </div>
    );
  }

  const total = questions.length;
  const last = index === total - 1;
  const q = questions[index];
  const missing = total - answeredCount;
  const low = left !== null && left <= 60;
  // Підтвердження — завжди: після цього відповіді з варіантами вже не змінити.
  const finish = () => setConfirm(true);

  return (
    <div className="ol-run">
      <div className="ol-bar">
        <span className="ol-progress">{`Завдання ${index + 1} з ${total}`}</span>
        <span className={`ol-timer${low ? ' is-low' : ''}`} role="timer" aria-live="off">
          {left === null ? '' : clock(left)}
        </span>
      </div>
      <div className="ol-track" aria-hidden="true"><i style={{ width: `${(answeredCount / (total || 1)) * 100}%` }} /></div>

      {q && (
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
      )}

      {error && <p className="ol-error" role="alert">{error}</p>}

      <div className="ol-nav">
        <button type="button" className="ol-btn ol-btn-ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0 || phase === 'sending'}>
          ← Назад
        </button>
        {last ? (
          <button type="button" className="ol-btn ol-btn-main" onClick={finish} disabled={phase === 'sending'}>
            {phase === 'sending' ? 'Надсилаємо…' : 'Завершити завдання'}
          </button>
        ) : (
          <button type="button" className="ol-btn ol-btn-main" onClick={() => setIndex((i) => Math.min(total - 1, i + 1))} disabled={phase === 'sending'}>
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
        <button type="button" className="ol-finish-link" onClick={finish} disabled={phase === 'sending'}>
          Завершити завдання зараз
        </button>
      )}

      {confirm && (
        <div className="ol-confirm" role="dialog" aria-modal="true" aria-label="Завершити завдання з варіантами?">
          <div className="ol-confirm-box">
            <h2 className="ol-h2">Завершити завдання з варіантами?</h2>
            {missing > 0 && <p className="ol-text">Без відповіді лишилось завдань: {missing}.</p>}
            <p className="ol-text">Після цього змінити ці відповіді не можна. Далі — останнє, відкрите завдання, вже без таймера.</p>
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
