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

const L = {
  uk: {
    doneTitle: 'Ви в списку! 🧡',
    doneText: 'Напишемо першим, щойно Dityam+ запуститься — зі знижкою для перших.',
    telegram: '✈️ Стати в список через Telegram — один тап',
    or: 'або email',
    placeholder: 'ваш@email.com',
    emailAria: 'Email для списку очікування',
    sending: 'Хвилинку…',
    submit: 'Дізнатися першим',
    error: 'Перевірте email — здається, у ньому одрук.',
    fine: 'Жодного спаму: один лист про запуск і знижку для перших.',
  },
  en: {
    doneTitle: 'You are on the list! 🧡',
    doneText: 'We will write to you first the moment Dityam+ launches — with an early-bird discount.',
    telegram: '✈️ Join the list through Telegram — one tap',
    or: 'or email',
    placeholder: 'your@email.com',
    emailAria: 'Email for the waiting list',
    sending: 'One moment…',
    submit: 'Tell me first',
    error: 'Check the email — there seems to be a typo.',
    fine: 'No spam: one message about the launch and the early-bird discount.',
  },
};

export default function SubscribeForm({ lang = 'uk' }) {
  const t = L[lang] || L.uk;
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
        body: JSON.stringify({ email: email.trim(), source: `pidbirka_${lang}` }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error('server');
      setState('done');
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'plus_waitlist_submit', {
          event_category: 'conversion',
          event_label: `pidbirka_${lang}`,
        });
      }
    } catch {
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <div style={{ marginTop: 26, padding: '20px 22px', borderRadius: 14, background: '#f0faf1', border: '1px solid #bfe3c6' }}>
        <strong style={{ fontSize: 17 }}>{t.doneTitle}</strong>
        <p style={{ margin: '6px 0 0', color: C.muted, fontSize: 15, lineHeight: 1.55 }}>
          {t.doneText}
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
        {t.telegram}
      </a>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '18px 0' }}>
        <span style={{ flex: 1, height: 1, background: C.line }} />
        <span style={{ fontSize: 13, color: C.muted }}>{t.or}</span>
        <span style={{ flex: 1, height: 1, background: C.line }} />
      </div>

      <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
          placeholder={t.placeholder}
          aria-label={t.emailAria}
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
          {state === 'sending' ? t.sending : t.submit}
        </button>
      </form>
      {state === 'error' && (
        <p style={{ margin: '10px 0 0', color: '#d92c2c', fontWeight: 600, fontSize: 14 }}>
          {t.error}
        </p>
      )}
      <p style={{ margin: '14px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
        {t.fine}
      </p>
    </div>
  );
}
