'use client';
import { useState } from 'react';

// «Поділитися»: на телефоні — системне меню (месенджери), на компʼютері —
// копіювання посилання.
export default function ShareWork({ title }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = window.location.href.split('#')[0];
    try {
      if (navigator.share) { await navigator.share({ title: `Малюнок «${title}»`, url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* людина закрила меню — нічого */ }
    if (window.gtag) window.gtag('event', 'obraz_share');
  }
  return (
    <button type="button" className="ob-btn ob-btn-ghost" onClick={share}>
      {copied ? 'Посилання скопійовано' : 'Поділитися'}
    </button>
  );
}
