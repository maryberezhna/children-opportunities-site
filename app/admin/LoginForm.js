'use client';
import { useState } from 'react';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        setError('Невірний пароль');
      }
    } catch {
      setError('Помилка мережі');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль адміністратора"
        autoFocus
        style={{ padding: '11px 14px', fontSize: 16, borderRadius: 10, border: '1px solid #d3dbe9' }}
      />
      <button
        type="submit"
        disabled={busy || !password}
        style={{ padding: '11px 14px', fontSize: 15, fontWeight: 600, borderRadius: 10, border: 'none', background: '#131b28', color: '#fff', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
      >
        {busy ? 'Вхід…' : 'Увійти'}
      </button>
      {error ? <div style={{ color: '#d92c2c', fontSize: 14 }}>{error}</div> : null}
    </form>
  );
}
