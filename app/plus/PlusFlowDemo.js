'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Анімований приклад підписки на /plus: одна можливість від першого
 * повідомлення до нагадування про дедлайн у Telegram. Вкладку «Імейл»
 * прибрано 15.09.2026 разом із листами Dityam+.
 *
 * Кроки перемикаються самі, лише коли блок видно, курсор чи фокус не всередині
 * і людина не просила менше руху. Клік по кроку зупиняє автоплей — людина
 * хоче роздивитись. Прогрес рахуємо самі, а не CSS-анімацією: так смужка
 * стоїть разом із таймером, коли автоплей на паузі.
 */

const STEP_MS = 3400;
const LAST_STEP_MS = 5200;
const TICK_MS = 60;

export default function PlusFlowDemo({ f }) {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [auto, setAuto] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hold, setHold] = useState(false);
  const [reduce, setReduce] = useState(false);
  const ref = useRef(null);

  const last = f.steps.length - 1;
  const dur = step === last ? LAST_STEP_MS : STEP_MS;
  const running = auto && visible && !hold && !reduce;

  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setElapsed((e) => e + TICK_MS), TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (elapsed < dur) return;
    setStep((s) => (s === last ? 0 : s + 1));
    setElapsed(0);
  }, [elapsed, dur, last]);

  const go = (i) => { setStep(i); setElapsed(0); };

  return (
    <div
      ref={ref}
      className="pl-fd"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHold(false); }}
    >
      {!reduce && (
        <div className="pl-fd-bar">
          <button
            type="button"
            className="pl-fd-play"
            aria-label={auto ? f.pause : f.play}
            title={auto ? f.pause : f.play}
            onClick={() => setAuto((a) => !a)}
          >
            {auto ? '❚❚' : '▶'}
          </button>
        </div>
      )}

      <ol className="pl-fd-steps">
        {f.steps.map(([head, sub], i) => (
          <li key={head}>
            <button
              type="button"
              className={`pl-fd-step${i === step ? ' is-on' : ''}${i < step ? ' is-done' : ''}`}
              aria-current={i === step ? 'step' : undefined}
              onClick={() => { go(i); setAuto(false); }}
            >
              <span className="pl-fd-num">{i + 1}</span>
              <span className="pl-fd-step-t">
                <strong>{head}</strong>
                <span>{sub}</span>
              </span>
              {i === step && auto && !reduce && (
                <span
                  className="pl-fd-prog"
                  aria-hidden="true"
                  style={{ transform: `scaleX(${Math.min(elapsed / dur, 1)})` }}
                />
              )}
            </button>
          </li>
        ))}
      </ol>

      <div className="pl-fd-screen">
        <TgScreen f={f} step={step} />
        {step === 1 && (
          <span className="pl-tg-toast pl-fd-toast" aria-hidden="true">
            {f.toast}
          </span>
        )}
        <div className={`pl-fd-cal${step === 2 ? ' is-open' : ''}`} aria-hidden={step !== 2}>
          <div className="pl-fd-cal-card">
            <p className="pl-fd-cal-app">📅 {f.calApp}</p>
            <div className="pl-fd-cal-row">
              <span className="pl-fd-cal-date">
                <span>{f.calMonth}</span>
                <strong>{f.calDay}</strong>
              </span>
              <span className="pl-fd-cal-info">
                <strong>{f.calTitle}</strong>
                <span>{f.calWhen}</span>
              </span>
            </div>
            <p className="pl-fd-cal-ok">✓ {f.calSaved}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Формат — scraper/personal_digest.py build_telegram і
// scraper/deadline_reminders.py build_text.
function TgScreen({ f, step }) {
  if (step === 3) {
    return (
      <div className="pl-tg pl-fd-chat">
        <div className="pl-fd-msg" key="remind">
          <span className="pl-fd-date">{f.remindDate}</span>
          <div className="pl-tg-bubble">
            <p className="pl-tg-title">{f.remindHead}</p>
            <p className="pl-tg-meta">{f.remindSub}</p>
            <p className="pl-tg-title pl-tg-text pl-fd-link">🔸 {f.title}</p>
            <p className="pl-tg-meta">{f.remindMeta}</p>
            <p className="pl-tg-meta"><i>{f.forWho}</i></p>
            <p className="pl-tg-more"><i>{f.remindFoot}</i></p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="pl-tg pl-fd-chat">
      <div className="pl-fd-msg" key="digest">
        <div className="pl-tg-bubble">
          <p className="pl-tg-title">{f.digestHead}</p>
          <p className="pl-tg-title pl-tg-text pl-fd-link">🔸 {f.title}</p>
          <p className="pl-tg-meta">{f.meta}</p>
          <p className="pl-tg-meta"><i>{f.forWho}</i></p>
          <p className="pl-tg-more"><i>{f.digestFoot}</i></p>
        </div>
        <div className="pl-tg-kb" aria-hidden="true">
          <span className={`pl-tg-btn${step === 2 ? ' is-on is-tap' : ''}`}>{f.cal}</span>
          <div className="pl-tg-row">
            <span className={`pl-tg-btn${step >= 1 ? ' is-on' : ''}${step === 1 ? ' is-tap' : ''}`}>{f.yes}</span>
            <span className="pl-tg-btn">{f.no}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
