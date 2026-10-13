'use client';
// Тренування без обмежень (лише Dityam+): ті самі 25 завдань, варіанти щоразу
// в іншому порядку, таймер не обовʼязковий; бали не йдуть на обкладинку.
import { useState } from 'react';

const L = ['А', 'Б', 'В', 'Г'];

export default function Practice({ token }) {
  const [st, setSt] = useState('idle'); // idle | run | done
  const [qs, setQs] = useState([]);
  const [order, setOrder] = useState([]);
  const [answers, setAnswers] = useState({});
  const [i, setI] = useState(0);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const call = (body) => fetch('/api/modnyi-kod/practice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, ...body }) }).then((r) => r.json());
  async function start() {
    setErr('');
    const j = await call({ action: 'start' }).catch(() => ({}));
    if (!j.questions) { setErr(j.error === 'plus_only' ? 'Тренування — для підписників Dityam+.' : 'Не вдалося завантажити. Спробуйте ще раз.'); return; }
    setQs(j.questions); setOrder(j.order); setAnswers({}); setI(0); setRes(null); setSt('run');
  }
  async function check() {
    const j = await call({ action: 'check', answers, order }).catch(() => ({}));
    if (j.score === undefined) { setErr('Не вдалося перевірити. Спробуйте ще раз.'); return; }
    setRes(j); setSt('done');
  }
  if (st === 'idle') return <div className="mkP"><button type="button" className="mk-btn-o" onClick={start}>🔁 Тренуватися ще раз</button><p className="mkJ-note">Скільки завгодно разів, у підписці Dityam+. Бали тренувань на обкладинку не йдуть.</p>{err ? <p className="mkJ-err">{err}</p> : null}</div>;
  if (st === 'done') {
    return (
      <div className="mkP">
        <h3 className="mkT-hand ink">Тренування: {res.score}/{res.max}</h3>
        {res.missed.map((m) => <article key={m.num} className="mkK-miss"><b>Завдання {m.num}.</b> {m.q}<p>💡 {m.hint}</p></article>)}
        <button type="button" className="mk-btn-y" onClick={start}>🔁 Ще раз</button>
      </div>
    );
  }
  const q = qs[i];
  return (
    <div className="mkR">
      <div className="mkR-bar"><span className="mkR-n">Тренування · {i + 1} з {qs.length}</span></div>
      <article className="mkT-q mkR-q">
        <span className="mkR-topic">{q.topic}</span>
        {q.art ? <div className="mkR-art" dangerouslySetInnerHTML={{ __html: q.art }} /> : null}
        <p>{q.q}</p>
        <ul>{q.options.map((o, k) => <li key={o.id}><button type="button" className={answers[q.id] === o.id ? 'on' : ''} onClick={() => setAnswers({ ...answers, [q.id]: o.id })}><b>{L[k]}</b> {o.text}</button></li>)}</ul>
      </article>
      {err ? <p className="mkJ-err">{err}</p> : null}
      <div className="mkR-nav">
        <button type="button" className="mk-btn-o" disabled={i === 0} onClick={() => setI(i - 1)}>← Назад</button>
        {i < qs.length - 1 ? <button type="button" className="mk-btn-y" onClick={() => setI(i + 1)}>Далі →</button> : <button type="button" className="mk-btn-y" onClick={check}>Перевірити</button>}
      </div>
    </div>
  );
}
