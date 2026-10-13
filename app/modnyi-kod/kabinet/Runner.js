'use client';
// Тест «Модного коду»: 1 завдання на екрані, таймер MK.minutes (рахує сервер),
// відповіді в localStorage на випадок оновлення сторінки, автоздача, коли
// час вийшов. Картинки беруть візерунки з DEFS сторінки.
import { useCallback, useEffect, useRef, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');
const clock = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
const L = ['А', 'Б', 'В', 'Г'];

export default function Runner({ token, started, minutes, attempt = 1 }) {
  const [phase, setPhase] = useState(started ? 'loading' : 'intro');
  const [qs, setQs] = useState([]);
  const [answers, setAnswers] = useState({});
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(null);
  const [err, setErr] = useState('');
  const dl = useRef(null);
  const sent = useRef(false);
  // Номер спроби в ключі: відповіді минулої спроби не підставляються в нову.
  const KEY = attempt > 1 ? `mk_a_${token}_${attempt}` : `mk_a_${token}`;
  const answersRef = useRef({});
  answersRef.current = answers;

  const begin = useCallback(async () => {
    setPhase('loading'); setErr('');
    try {
      const r = await fetch('/api/modnyi-kod/begin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) { window.location.reload(); return; }
      if (!r.ok || !Array.isArray(j.questions)) throw new Error('bad');
      dl.current = new Date(j.deadline).getTime() + (Date.now() - new Date(j.now).getTime());
      let saved = {}; try { saved = JSON.parse(window.localStorage.getItem(KEY) || '{}'); } catch { /* ок */ }
      setAnswers(saved || {}); setQs(j.questions);
      setLeft(Math.max(0, Math.round((dl.current - Date.now()) / 1000)));
      setPhase('run');
    } catch { setPhase('error'); setErr('Не вдалося завантажити завдання. Перевірте інтернет і спробуйте ще раз.'); }
  }, [token, KEY]);

  const submit = useCallback(async (cur) => {
    if (sent.current) return;
    sent.current = true; setPhase('sending');
    try {
      const r = await fetch('/api/modnyi-kod/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, answers: cur }) });
      if (!r.ok) throw new Error('bad');
      try { window.localStorage.removeItem(KEY); } catch { /* ок */ }
      if (typeof window.gtag === 'function') window.gtag('event', 'modnyi_kod_test_done');
      window.location.reload();
    } catch { sent.current = false; setPhase('run'); setErr('Не вдалося надіслати відповіді. Перевірте інтернет — і натисніть «Завершити» ще раз.'); }
  }, [token, KEY]);

  useEffect(() => { if (started) begin(); }, [started, begin]);
  useEffect(() => {
    if (phase !== 'run') return undefined;
    const id = setInterval(() => {
      const s = Math.max(0, Math.round((dl.current - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) submit(answersRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [phase, submit]);
  function pick(qid, opt) {
    const next = { ...answers, [qid]: opt };
    setAnswers(next);
    try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ок */ }
  }

  if (phase === 'intro') {
    return (
      <div className="mkR-intro">
        <h2 className="mkT-hand ink">Готова? Починаємо!</h2>
        <ul className="mkT-incl"><li>25 завдань</li><li>{minutes} хвилин</li><li>{attempt > 1 ? `спроба ${attempt}` : 'можна перепройти'}</li></ul>
        <p className="mkT-text">Час піде, щойно натиснеш «Почати». Між завданнями можна ходити вперед і назад. Коли час вийде, відповіді відправляться самі.</p>
        <button type="button" className="mk-btn-y" onClick={begin}>Почати тест</button>
      </div>
    );
  }
  if (phase === 'loading' || phase === 'sending') return <p className="mkT-text">{phase === 'sending' ? 'Рахуємо бали…' : 'Завантажуємо завдання…'}</p>;
  if (phase === 'error') return <div><p className="mkJ-err">{err}</p><button type="button" className="mk-btn-y" onClick={begin}>Спробувати ще раз</button></div>;

  const q = qs[i];
  const done = Object.keys(answers).length;
  return (
    <div className="mkR">
      <div className="mkR-bar">
        <span className="mkR-n">Завдання {i + 1} з {qs.length}</span>
        <span className={`mkR-clock${left < 60 ? ' hot' : ''}`}>⏱ {clock(left ?? 0)}</span>
      </div>
      <div className="mkR-dots">{qs.map((x, k) => <button key={x.id} type="button" aria-label={`Завдання ${k + 1}`} className={`${k === i ? 'cur' : ''}${answers[x.id] !== undefined ? ' ok' : ''}`} onClick={() => setI(k)} />)}</div>
      <article className="mkT-q mkR-q">
        <span className="mkR-topic">{q.topic}</span>
        {q.art ? <div className="mkR-art" dangerouslySetInnerHTML={{ __html: q.art }} /> : null}
        <p>{q.q}</p>
        <ul>
          {q.options.map((o, k) => (
            <li key={o.id}><button type="button" className={answers[q.id] === o.id ? 'on' : ''} onClick={() => pick(q.id, o.id)}><b>{L[k]}</b> {o.text}</button></li>
          ))}
        </ul>
      </article>
      {err ? <p className="mkJ-err">{err}</p> : null}
      <div className="mkR-nav">
        <button type="button" className="mk-btn-o" disabled={i === 0} onClick={() => setI(i - 1)}>← Назад</button>
        {i < qs.length - 1
          ? <button type="button" className="mk-btn-y" onClick={() => setI(i + 1)}>Далі →</button>
          : <button type="button" className="mk-btn-y" onClick={() => { if (done < qs.length && !window.confirm(`Відповіді є на ${done} з ${qs.length}. Завершити?`)) return; submit(answers); }}>Завершити тест</button>}
      </div>
    </div>
  );
}
