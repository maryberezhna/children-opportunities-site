'use client';
import { useState } from 'react';

/**
 * «Поділитися підбіркою»: копіює адресу сторінки й на дві секунди каже, що
 * посилання скопійовано (макет design_handoff_dityam_pidbirka). Якщо буфер
 * обміну недоступний (старий браузер, не-https), пробуємо системне «Поділитися».
 */
export default function ShareButton({ label, doneLabel }) {
  const [done, setDone] = useState(false);

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      if (navigator.share) {
        try { await navigator.share({ url }); } catch { /* людина скасувала */ }
      }
    }
  }

  return (
    <button type="button" className="tp-btn tp-btn-outline" onClick={share} aria-live="polite">
      {done ? doneLabel : label}
    </button>
  );
}
