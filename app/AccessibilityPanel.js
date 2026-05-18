'use client';
import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'a11y-settings';

const DEFAULTS = {
  fontSize: 100,
  letterSpacing: 0,
  bw: false,
  largeCursor: false,
  readingLine: false,
  underlineLinks: false,
};

function loadSettings() {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function applySettings(s) {
  const html = document.documentElement;
  html.style.setProperty('--a11y-font-scale', s.fontSize / 100);
  html.style.setProperty('--a11y-letter-spacing', `${s.letterSpacing}em`);
  html.classList.toggle('a11y-bw', s.bw);
  html.classList.toggle('a11y-large-cursor', s.largeCursor);
  html.classList.toggle('a11y-reading-line', s.readingLine);
  html.classList.toggle('a11y-underline-links', s.underlineLinks);
}

export default function AccessibilityPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    applySettings(s);
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      applySettings(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = () => {
    update(DEFAULTS);
  };

  const isDefault =
    settings.fontSize === 100 &&
    settings.letterSpacing === 0 &&
    !settings.bw &&
    !settings.largeCursor &&
    !settings.readingLine &&
    !settings.underlineLinks;

  return (
    <>
      {/* Trigger */}
      <button
        className="a11y-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Налаштування доступності"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        </svg>
        <span>Доступність</span>
      </button>

      {/* Backdrop */}
      {open && (
        <div className="a11y-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      {/* Panel */}
      <div className={`a11y-panel${open ? ' a11y-panel--open' : ''}`} role="dialog" aria-label="Налаштування доступності" aria-modal="true">
        <div className="a11y-panel-header">
          <span>Налаштування доступності</span>
          <button className="a11y-close" onClick={() => setOpen(false)} aria-label="Закрити">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="a11y-panel-body">
          {/* Font size */}
          <div className="a11y-row">
            <label className="a11y-label">Розмір тексту</label>
            <div className="a11y-stepper">
              <button
                className="a11y-step-btn"
                onClick={() => update({ fontSize: Math.max(80, settings.fontSize - 10) })}
                aria-label="Зменшити текст"
                disabled={settings.fontSize <= 80}
              >−</button>
              <span className="a11y-step-val">{settings.fontSize}%</span>
              <button
                className="a11y-step-btn"
                onClick={() => update({ fontSize: Math.min(150, settings.fontSize + 10) })}
                aria-label="Збільшити текст"
                disabled={settings.fontSize >= 150}
              >+</button>
            </div>
          </div>

          {/* Letter spacing */}
          <div className="a11y-row">
            <label className="a11y-label">Відступи між буквами</label>
            <div className="a11y-stepper">
              <button
                className="a11y-step-btn"
                onClick={() => update({ letterSpacing: Math.max(0, settings.letterSpacing - 1) })}
                aria-label="Зменшити відступ"
                disabled={settings.letterSpacing <= 0}
              >−</button>
              <span className="a11y-step-val">{settings.letterSpacing}%</span>
              <button
                className="a11y-step-btn"
                onClick={() => update({ letterSpacing: Math.min(10, settings.letterSpacing + 1) })}
                aria-label="Збільшити відступ"
                disabled={settings.letterSpacing >= 10}
              >+</button>
            </div>
          </div>

          {/* Divider */}
          <div className="a11y-divider" />

          {/* Color mode */}
          <div className="a11y-row">
            <label className="a11y-label">Колір</label>
            <div className="a11y-toggle-group">
              <button
                className={`a11y-toggle-btn${!settings.bw ? ' active' : ''}`}
                onClick={() => update({ bw: false })}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" fill="#f6a623" />
                  <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#f6a623" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Колір
              </button>
              <button
                className={`a11y-toggle-btn${settings.bw ? ' active' : ''}`}
                onClick={() => update({ bw: true })}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2z" fill="#888" />
                  <path d="M12 2v20A10 10 0 0 0 12 2z" fill="#222" />
                </svg>
                Ч/Б
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="a11y-divider" />

          <p className="a11y-section-title">Інше</p>

          {/* Large cursor */}
          <div className="a11y-row a11y-row--toggle">
            <span className="a11y-label">Великий курсор</span>
            <button
              role="switch"
              aria-checked={settings.largeCursor}
              className={`a11y-switch${settings.largeCursor ? ' on' : ''}`}
              onClick={() => update({ largeCursor: !settings.largeCursor })}
            >
              <span className="a11y-switch-thumb" />
            </button>
          </div>

          {/* Reading line */}
          <div className="a11y-row a11y-row--toggle">
            <span className="a11y-label">Лінія для читання</span>
            <button
              role="switch"
              aria-checked={settings.readingLine}
              className={`a11y-switch${settings.readingLine ? ' on' : ''}`}
              onClick={() => update({ readingLine: !settings.readingLine })}
            >
              <span className="a11y-switch-thumb" />
            </button>
          </div>

          {/* Underline links */}
          <div className="a11y-row a11y-row--toggle">
            <span className="a11y-label">Підкреслювати посилання</span>
            <button
              role="switch"
              aria-checked={settings.underlineLinks}
              className={`a11y-switch${settings.underlineLinks ? ' on' : ''}`}
              onClick={() => update({ underlineLinks: !settings.underlineLinks })}
            >
              <span className="a11y-switch-thumb" />
            </button>
          </div>

          {/* Divider */}
          <div className="a11y-divider" />

          {/* Reset */}
          <button
            className="a11y-reset-btn"
            onClick={reset}
            disabled={isDefault}
          >
            × Скасувати зміни
          </button>
        </div>
      </div>

      {/* Reading line overlay */}
      {settings.readingLine && <ReadingLine />}
    </>
  );
}

function ReadingLine() {
  const [y, setY] = useState(-100);

  useEffect(() => {
    const onMove = (e) => setY(e.clientY);
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    <div
      className="a11y-reading-line-el"
      style={{ top: `${y}px` }}
      aria-hidden="true"
    />
  );
}
