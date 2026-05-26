'use client';
import { useEffect } from 'react';

const STORAGE_KEY = 'dityam:calendar-provider';

export default function AddToCalendarFlow({ googleUrl, icsUrl, defaultProvider, slug }) {
  useEffect(() => {
    const saved = typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY)
      : null;
    const provider = saved || defaultProvider;

    const timer = setTimeout(() => {
      if (provider === 'apple') {
        window.location.href = icsUrl;
      } else {
        window.location.href = googleUrl;
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [googleUrl, icsUrl, defaultProvider]);

  function handleChoice(provider) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, provider);
    }
    if (provider === 'apple') {
      window.location.href = icsUrl;
    } else {
      window.location.href = googleUrl;
    }
  }

  return (
    <div className="cal-add-buttons">
      <button
        type="button"
        className="cal-add-btn cal-add-btn-primary"
        onClick={() => handleChoice('google')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Google Calendar
      </button>

      <button
        type="button"
        className="cal-add-btn"
        onClick={() => handleChoice('apple')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Apple / Outlook
      </button>
    </div>
  );
}
