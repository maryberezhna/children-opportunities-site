'use client';
import { useState } from 'react';

/**
 * Продаж Dityam+ на паузі — сторінка лише додає в список очікування.
 * Два шляхи в ту саму таблицю plus_waitlist: Telegram одним тапом
 * (деп-лінк у бота, найнижчий поріг) або email для тих, хто без Telegram.
 * Стара анкета профілю (вік/інтереси/канал) повернеться разом із запуском.
 */
const C = {
  ink: '#131b28', muted: '#54617a', line: '#d3dbe9', orange: '#db5a1e',
};

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error

  async function submit(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setState('error'); return; }
    setState('sending');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'pidbirka' }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error('server');
      setState('done');
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'plus_waitlist_submit', {
          event_category: 'conversion',
          event_label: 'pidbirka',
        });
      }
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div style={{ marginTop: 26, padding: '20px 22px', borderRadius: 14, background: '#f0faf1', border: '1px solid #bfe3c6' }}>
        <strong style={{ fontSize: 17 }}>Ви в списку! 🧡</strong>
        <p style={{ margin: '6px 0 0', color: C.muted, fontSize: 15, lineHeight: 1.55 }}>
          Напишемо першим, щойно Dityam+ запуститься — зі знижкою для перших.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 26 }}>
      {/* Telegram — головний шлях: один тап, і людина в списку */}
      <a
        href="https://t.me/DityamComUABot?start=plus"
        style={{
          display: 'block', textAlign: 'center', padding: '15px 20px',
          borderRadius: 12, background: '#229ED9', color: '#fff',
          fontSize: 16, fontWeight: 700, textDecoration: 'none',
        }}
      >
        ✈️ Стати в список через Telegram — один тап
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
        <span style={{ flex: 1, height: 1, background: C.line }} />
        <span style={{ fontSize: 13, color: C.muted }}>або email</span>
        <span style={{ flex: 1, height: 1, background: C.line }} />
      </div>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
          placeholder="ваш@email.com"
          aria-label="Email для списку очікування"
          autoComplete="email"
          style={{
            flex: '1 1 220px', minWidth: 0, fontSize: 15, padding: '13px 15px',
            borderRadius: 12, border: `1px solid ${C.line}`, fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          style={{
            flexShrink: 0, padding: '13px 22px', fontSize: 15, fontWeight: 700,
            borderRadius: 12, border: 'none',
            cursor: state === 'sending' ? 'wait' : 'pointer',
            background: C.orange, color: '#fff', opacity: state === 'sending' ? 0.6 : 1,
          }}
        >
          {state === 'sending' ? 'Хвилинку…' : 'Дізнатися першим'}
        </button>
      </form>
      {state === 'error' && (
        <p style={{ margin: '10px 0 0', color: '#d92c2c', fontWeight: 600, fontSize: 14 }}>
          Перевірте email — здається, у ньому одрук.
        </p>
      )}
      <p style={{ margin: '14px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
        Жодного спаму: один лист про запуск і знижку для перших.
      </p>
    </div>
  );
}
