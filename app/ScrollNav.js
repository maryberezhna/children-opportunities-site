'use client';
import { useEffect, useState } from 'react';

const NEAR_TOP = 300;
const NEAR_BOTTOM = 200;

export default function ScrollNav() {
  const [showUp, setShowUp] = useState(false);
  const [showDown, setShowDown] = useState(false);

  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      const doc = document.documentElement.scrollHeight;
      setShowUp(y > NEAR_TOP);
      setShowDown(doc - (y + vh) > NEAR_BOTTOM);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.gtag) window.gtag('event', 'scroll_to_top', { event_category: 'navigation' });
  };

  const scrollBottom = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    if (window.gtag) window.gtag('event', 'scroll_to_bottom', { event_category: 'navigation' });
  };

  if (!showUp && !showDown) return null;

  return (
    <div className="scroll-nav" aria-hidden={false}>
      {showUp && (
        <button
          type="button"
          className="scroll-nav-btn"
          onClick={scrollTop}
          aria-label="Прокрутити нагору"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </button>
      )}
      {showDown && (
        <button
          type="button"
          className="scroll-nav-btn"
          onClick={scrollBottom}
          aria-label="Прокрутити донизу"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}
    </div>
  );
}
