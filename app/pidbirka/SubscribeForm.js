'use client';
import { useState } from 'react';
import { THEME_OPTIONS } from '@/lib/themes';

const AGE_BANDS = [
  ['0-3', '0–3 роки'], ['4-6', '4–6 років'], ['7-10', '7–10 років'],
  ['11-14', '11–14 років'], ['15-18', '15–18 років'],
];
const INTERESTS = THEME_OPTIONS.filter((o) => o.value !== 'all');
const GENDERS = [['any', 'Будь-хто'], ['boy', 'Хлопчик'], ['girl', 'Дівчинка']];

const C = {
  ink: '#131b28', muted: '#54617a', line: '#d3dbe9', blue: '#1e4fd6', orange: '#db5a1e',
  green: '#15803d', chipBg: '#f4f6fb',
};

const chip = (on) => ({
  display: 'inline-block', padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
  fontSize: 14, fontWeight: 600, userSelect: 'none',
  border: `1.5px solid ${on ? C.blue : C.line}`,
  background: on ? C.blue : '#fff', color: on ? '#fff' : C.muted,
});
const label = { display: 'block', fontSize: 13, fontWeight: 700, color: C.ink, margin: '22px 0 10px' };
const input = { width: '100%', boxSizing: 'border-box', fontSize: 15, padding: '11px 13px', borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: 'inherit' };

function toggle(list, v) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export default function SubscribeForm() {
  const [ages, setAges] = useState([]);
  const [interests, setInterests] = useState([]);
  const [gender, setGender] = useState('any');
  const [freeOnly, setFreeOnly] = useState(false);
  const [channel, setChannel] = useState('telegram');
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // {ok, msg}

  const valid = ages.length && interests.length && consent &&
    (channel === 'email' ? /\S+@\S+\.\S+/.test(email) : handle.trim().length > 1);

  async function submit(e) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true); setDone(null);
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel, email: email.trim(), telegram_handle: handle.trim(),
          age_bands: ages, interests, gender,
          cost_pref: freeOnly ? 'free_only' : 'any', consent,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone({ ok: true, channel });
      } else {
        setDone({ ok: false, msg: j.error === 'duplicate' ? 'Ти вже підписаний(а) на цю пошту.' : 'Щось пішло не так. Спробуй ще раз.' });
      }
    } catch {
      setDone({ ok: false, msg: 'Помилка мережі. Спробуй ще раз.' });
    } finally { setBusy(false); }
  }

  if (done?.ok) {
    return (
      <div style={{ marginTop: 26, padding: '22px 20px', borderRadius: 14, background: '#f0f9f2', border: `1px solid #bfe6cd` }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.green }}>🎉 Готово!</div>
        <p style={{ margin: '10px 0 0', fontSize: 15, color: C.ink, lineHeight: 1.6 }}>
          {done.channel === 'telegram'
            ? <>Останній крок — відкрий <a href="https://t.me/DityamComUABot?start=digest" target="_blank" rel="noreferrer" style={{ color: C.blue, fontWeight: 600 }}>@DityamComUABot</a> і натисни <b>Почати</b>, щоб ми могли надсилати підбірку саме тобі.</>
            : <>Ми надішлемо першу персональну підбірку на <b>{email}</b> найближчим часом. Перевір теку «Промоакції», якщо не бачиш листа.</>}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 10 }}>
      <label style={label}>Вік дитини <span style={{ color: C.orange }}>*</span> <span style={{ fontWeight: 400, color: C.muted }}>— можна кілька</span></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {AGE_BANDS.map(([v, l]) => (
          <span key={v} style={chip(ages.includes(v))} onClick={() => setAges((s) => toggle(s, v))}>{l}</span>
        ))}
      </div>

      <label style={label}>Інтереси <span style={{ color: C.orange }}>*</span> <span style={{ fontWeight: 400, color: C.muted }}>— що цікавить дитину</span></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {INTERESTS.map((o) => (
          <span key={o.value} style={chip(interests.includes(o.value))} onClick={() => setInterests((s) => toggle(s, o.value))}>{o.label}</span>
        ))}
      </div>

      <label style={label}>Стать <span style={{ fontWeight: 400, color: C.muted }}>— щоб краще підбирати (необовʼязково)</span></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {GENDERS.map(([v, l]) => (
          <span key={v} style={chip(gender === v)} onClick={() => setGender(v)}>{l}</span>
        ))}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 0', cursor: 'pointer', fontSize: 15, color: C.ink }}>
        <input type="checkbox" checked={freeOnly} onChange={(e) => setFreeOnly(e.target.checked)} style={{ width: 18, height: 18 }} />
        Надсилати лише безкоштовні можливості
      </label>

      <label style={label}>Куди надсилати підбірку? <span style={{ color: C.orange }}>*</span></label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <span style={chip(channel === 'telegram')} onClick={() => setChannel('telegram')}>✈️ Telegram</span>
        <span style={chip(channel === 'email')} onClick={() => setChannel('email')}>✉️ Email</span>
      </div>
      {channel === 'email'
        ? <input style={input} type="email" placeholder="твоя пошта" value={email} onChange={(e) => setEmail(e.target.value)} />
        : <input style={input} type="text" placeholder="@твій_нік у Telegram" value={handle} onChange={(e) => setHandle(e.target.value)} />}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '22px 0 0', cursor: 'pointer', fontSize: 13.5, color: C.muted, lineHeight: 1.5 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0 }} />
        <span>Погоджуюсь отримувати підбірку й розумію, що можу відписатись будь-коли. Ми зберігаємо лише вік-діапазон та інтереси — <b style={{ color: C.ink }}>жодних точних даних дитини</b>.</span>
      </label>

      <button type="submit" disabled={!valid || busy} style={{
        marginTop: 22, width: '100%', padding: '14px', fontSize: 16, fontWeight: 700,
        borderRadius: 12, border: 'none', cursor: valid && !busy ? 'pointer' : 'not-allowed',
        background: valid && !busy ? C.orange : C.line, color: '#fff',
      }}>{busy ? 'Надсилаю…' : 'Оформити підбірку'}</button>

      {done && !done.ok ? <p style={{ marginTop: 12, color: '#d92c2c', fontWeight: 600, fontSize: 14 }}>{done.msg}</p> : null}
    </form>
  );
}
