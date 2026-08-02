'use client';
import { useEffect } from 'react';

// Реєстрація service worker'а. Тільки в проді: у dev він кешував би
// гарячі оновлення і зневаджувати стало б боляче.
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline-режим — приємний бонус, а не умова роботи сайту.
        // Не вдалося зареєструвати — сайт просто працює як звичайно.
      });
    };
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
