'use client';
import { useState } from 'react';

// Кнопка «Скопіювати» для готового опису на /press: журналіст забирає абзац
// одним кліком, а не виділяє мишкою. Без буфера обміну (старий браузер,
// http) тихо не робить нічого — текст і так поруч.
export default function CopyButton({ text, label, done, className }) {
  const [ok, setOk] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
      setTimeout(() => setOk(false), 2000);
      if (window.gtag) window.gtag('event', 'press_copy_description');
    } catch { /* немає clipboard API */ }
  }

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {ok ? done : label}
    </button>
  );
}
