'use client';

// Проходження тесту: одне завдання на екрані, таймер, перехід між завданнями.
// Останній крок — відкрите завдання, у тих самих хвилинах (Марія, 06.10.2026).
// Час рахує сервер (started_at); браузер лише показує, скільки лишилось.
// Коли час вийшов — табло «Відправити відповідь» з відліком 2 хвилини:
// дописати відкрите завдання й надіслати; потім усе відправляється само.
// Відповіді зберігаються в localStorage, тож оновлення сторінки чи
// розряджений телефон їх не стирають.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');
const clock = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

export default function TestRunner({ token, name, started, count, minutes, overtime, openTask, until }) {
  const [phase, setPhase] = useState(started ? 'loading' : 'intro'); // intro | loading | run | sending | done | error
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [openText, setOpenText] = useState('');
  const [index, setIndex] = useState(0);       // questions.length — крок відкритого завдання
  const [left, setLeft] = useState(null);      // секунд до кінця основного часу
  const [overLeft, setOverLeft] = useState(null); // секунд табло «Відправити відповідь»
  const [timeUp, setTimeUp] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const deadlineRef = useRef(null);            // мітка часу за годинником браузера
  const sentRef = useRef(false);
  const autoRef = useRef(false);             // табло скінчилось — здаємо сам лише 1 раз
  const storeKey = `olimp_a_${token}`;
  const openKey = `olimp_o_${token}`;
  const overtimeMin = Math.round(overtime / 60);

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
      // Оновили сторінку вже після сигналу — одразу на табло.
      if (s <= 0) setTimeUp(true);
      setPhase('run');
    } catch {
      setPhase('error');
      setError('Не вдалося завантажити завдання. Перевірте інтернет і спробуйте ще раз.');
    }
  }, [token, name, storeKey, openKey]);

  const submit = useCallback(async (current, open) => {
    if (sentRef.current) return;
    sentRef.current = true;
    setPhase('sending');
    setConfirm(false);
    try {
      const r = await fetch('/api/olimpiada/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, answers: current, open }),
      });
      if (r.status === 503) throw new Error('later');
      if (!r.ok) throw new Error('bad');
      try { window.localStorage.removeItem(storeKey); window.localStorage.removeItem(openKey); } catch { /* ок */ }
      if (typeof window.gtag === 'function') window.gtag('event', 'olimpiada_finish', { event_label: 'lohika_9_11' });
      setPhase('done');
      window.location.replace(`/olimpiada/test?t=${token}`);
    } catch (e) {
      sentRef.current = false;
      setPhase('run');
      setError(e && e.message === 'later'
        ? 'Сервер тимчасово не приймає відповіді. Вони збережені — зачекай хвилину й натисни кнопку ще раз.'
        : 'Не вдалося надіслати відповіді. Перевірте інтернет і натисніть кнопку ще раз.');
    }
  }, [token, storeKey, openKey]);

  // Актуальні відповіді для таймера — без перезапуску інтервалу на кожен клік.
  const answersRef = useRef(answers);
  const openRef = useRef(openText);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { openRef.current = openText; }, [openText]);

  // Тест уже почато (оновили сторінку) — одразу повертаємо дитину до завдань.
  useEffect(() => { if (started) begin(); }, [started, begin]);

  useEffect(() => {
    if (phase !== 'run') return undefined;
    const tick = () => {
      const ms = deadlineRef.current - Date.now();
      setLeft(Math.max(0, Math.round(ms / 1000)));
      if (ms > 0) return;
      setTimeUp(true);
      const over = Math.max(0, Math.round((ms + overtime * 1000) / 1000));
      setOverLeft(over);
      if (over <= 0 && !autoRef.current) {
        autoRef.current = true;
        submit(answersRef.current, openRef.current);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, submit, overtime]);

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
        <span>Твоя задача й розвʼязок</span>
        <textarea
          value={openText} onChange={(e) => writeOpen(e.target.value)} maxLength={openTask.maxLength} rows={8}
          placeholder="Умова задачі… Розвʼязок…" disabled={phase === 'sending'}
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
          <li>останнє завдання — відкрите: придумай свою логічну задачу. Саме воно вирішує, хто отримає приз місяця</li>
          <li>{minutes} хвилин на все, разом із відкритим завданням — час піде, щойно натиснеш «Почати»</li>
          <li>коли час вийде, буде ще {overtimeMin} хвилини, щоб дописати й відправити відповіді, — потім вони відправляться самі</li>
          <li>1 спроба: завдання можна гортати вперед і назад та міняти відповідь</li>
          <li>відповідай сам чи сама — так диплом буде справді твоїм</li>
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

  // Табло: основний час вийшов, відповіді з варіантами вже не міняються.
  if (timeUp) {
    const low = overLeft !== null && overLeft <= 30;
    return (
      <div className="ol-panel ol-overtime" role="region" aria-label="Час вийшов">
        <p className="ol-kicker">Час вийшов</p>
        <h1 className="ol-h2">Відправ відповіді</h1>
        <p className="ol-text">
          Відповіді на завдання з варіантами зафіксовано. Є ще {overtimeMin} хвилини, щоб дописати відкрите завдання
          й натиснути «Відправити відповіді». Потім усе відправиться само.
        </p>
        <p className={`ol-overtime-timer${low ? ' is-low' : ''}`} role="timer" aria-live="off">
          {overLeft === null ? clock(overtime) : clock(overLeft)}
        </p>
        <p className="ol-overtime-task"><b>{openTask.title}.</b> {openTask.text}</p>
        {openField}
        {error && <p className="ol-error" role="alert">{error}</p>}
        <button type="button" className="ol-btn ol-btn-main ol-btn-wide" onClick={() => submit(answers, openText)} disabled={phase === 'sending'}>
          {phase === 'sending' ? 'Надсилаємо…' : 'Відправити відповіді'}
        </button>
      </div>
    );
  }

  const total = questions.length;
  const onOpen = index === total;
  const q = onOpen ? null : questions[index];
  const missing = total - answeredCount;
  const openEmpty = !openText.trim();
  const low = left !== null && left <= 60;
  const finish = () => ((missing || openEmpty) ? setConfirm(true) : submit(answers, openText));

  return (
    <div className="ol-run">
      <div className="ol-bar">
        <span className="ol-progress">{onOpen ? 'Відкрите завдання' : `Завдання ${index + 1} з ${total}`}</span>
        <span className={`ol-timer${low ? ' is-low' : ''}`} role="timer" aria-live="off">
          {left === null ? '' : clock(left)}
        </span>
      </div>
      <div className="ol-track" aria-hidden="true"><i style={{ width: `${((answeredCount + (openEmpty ? 0 : 1)) / (total + 1)) * 100}%` }} /></div>

      {onOpen ? (
        <div className="ol-q ol-q-open">
          <p className="ol-kicker">Останнє завдання · відкрите</p>
          <h1 className="ol-q-text">{openTask.title}</h1>
          <p className="ol-text">{openTask.text}</p>
          <p className="ol-note">
            Саме воно вирішує, хто отримає приз місяця. Журі оцінює: {openTask.criteria.join(', ')}.
            На диплом воно не впливає.
          </p>
          {openField}
        </div>
      ) : (
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
        {onOpen ? (
          <button type="button" className="ol-btn ol-btn-main" onClick={finish} disabled={phase === 'sending'}>
            {phase === 'sending' ? 'Надсилаємо…' : 'Завершити'}
          </button>
        ) : (
          <button type="button" className="ol-btn ol-btn-main" onClick={() => setIndex((i) => Math.min(total, i + 1))} disabled={phase === 'sending'}>
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
        <button
          type="button" aria-label={`Відкрите завдання${openEmpty ? '' : ', є відповідь'}`}
          className={`ol-dot ol-dot-open${onOpen ? ' is-here' : ''}${openEmpty ? '' : ' is-done'}`}
          onClick={() => setIndex(total)} disabled={phase === 'sending'}
        >
          ✍
        </button>
      </div>

      {!onOpen && (
        <button type="button" className="ol-finish-link" onClick={finish} disabled={phase === 'sending'}>
          Завершити тест зараз
        </button>
      )}

      {confirm && (
        <div className="ol-confirm" role="dialog" aria-modal="true" aria-label="Завершити тест?">
          <div className="ol-confirm-box">
            <h2 className="ol-h2">Завершити тест?</h2>
            {missing > 0 && <p className="ol-text">Без відповіді лишилось завдань: {missing}.</p>}
            {openEmpty && <p className="ol-text">Відкрите завдання ще порожнє — без нього немає участі в конкурсі на приз місяця.</p>}
            <p className="ol-text">Після завершення змінити відповіді не можна.</p>
            <div className="ol-actions">
              <button type="button" className="ol-btn ol-btn-ghost" onClick={() => setConfirm(false)}>Повернутися до завдань</button>
              <button type="button" className="ol-btn ol-btn-main" onClick={() => submit(answers, openText)}>Завершити</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
