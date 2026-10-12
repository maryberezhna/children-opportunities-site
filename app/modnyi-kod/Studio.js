'use client';

// Онлайн-студія образу «Модного коду» — безкоштовна частина (12.10.2026).
// Перенесено з прототипу, який Марія схвалила: фігурка на пів екрана, свайп
// або стрілки ‹ › перемикають варіант, під нею рядок мініатюр речей, унизу
// вкладки; тап по речі на фігурці відкриває тканини саме для неї. Назва
// образу обовʼязкова: без неї «Готово» блимає червоним і далі не пускає.
// Образ зберігається в браузері — щоб не загубився до старту олімпіади.
import { useEffect, useRef, useState } from 'react';
import { PIECES, PAL, FABRICS, DEFS, DEFAULT_LOOK, shape, fill, lookSvg, targets, usedPatterns, cleanLook } from '@/lib/modnyi-kod-looks';
import { MK } from '@/lib/modnyi-kod';
import Waitlist from './Waitlist';

const KEY = 'modnyi_kod_look';
const TABS = [
  { k: 'base', icon: '👗', label: 'Сукня', opts: ['dress1', 'dress2'] },
  { k: 'top', icon: '👕', label: 'Верх', opts: Object.keys(PIECES.top.opts) },
  { k: 'bottom', icon: '👖', label: 'Низ', opts: Object.keys(PIECES.bottom.opts) },
  { k: 'outer', icon: '🧥', label: 'Верхній', opts: Object.keys(PIECES.outer.opts) },
  { k: 'shoes', icon: '👟', label: 'Взуття', opts: Object.keys(PIECES.shoes.opts) },
  { k: 'acc', icon: '👜', label: 'Аксес.', opts: Object.keys(PIECES.acc.opts) },
  { k: 'fabric', icon: '🎨', label: 'Тканина' },
];
// Кадр мініатюри — навколо самої речі.
const VIEW = { base: '40 50 120 260', top: '40 40 120 160', bottom: '40 160 120 260', outer: '30 40 140 280', shoes: '50 370 110 70', acc: '50 0 110 200' };
const COLORS = [...PAL, ...FABRICS];

function Svg({ html, viewBox, className }) {
  return <svg viewBox={viewBox} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Thumb({ k, v, look }) {
  if (v === 'none') {
    return <Svg viewBox="0 0 10 10" html='<circle cx="5" cy="5" r="3.5" fill="none" stroke="#bbb" stroke-width=".8"/><path d="M2.5 7.5 L7.5 2.5" stroke="#bbb" stroke-width=".8"/>' />;
  }
  const f = fill(look.f[k] || '#c8501a');
  return <Svg viewBox={VIEW[k]} html={`<g filter="url(#mk-wob)">${shape[v](f)}</g>`} />;
}

const Swatch = ({ v }) => <Svg viewBox="0 0 60 60" html={`<rect width="60" height="60" fill="${fill(v)}"/>`} />;

export default function Studio() {
  const [look, setLook] = useState(DEFAULT_LOOK);
  const [title, setTitle] = useState('');
  const [tab, setTab] = useState('top');
  const [target, setTarget] = useState('top');
  const [flash, setFlash] = useState(0);
  const [cover, setCover] = useState(false);
  const [err, setErr] = useState(0);
  const titleRef = useRef(null);
  const swipe = useRef(null);

  // Образ із минулого заходу.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
      if (saved) { setLook(cleanLook(saved.look)); setTitle(String(saved.title || '').slice(0, MK.titleMax)); }
    } catch { /* приватний режим — починаємо з нуля */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify({ look, title })); } catch { /* ок */ }
  }, [look, title]);

  const tg = targets(look);
  const tgKey = tg.some(([k]) => k === target) ? target : tg[0][0];
  const tgName = (tg.find(([k]) => k === tgKey) || [])[1] || '';

  const update = (fn) => setLook((l) => { const n = JSON.parse(JSON.stringify(l)); fn(n); return n; });
  const cur = (k) => (k === 'base' ? (look.base === 'set' ? null : look.base) : look[k]);
  function choose(k, v) {
    update((n) => {
      if (k === 'base') n.base = v;
      else { n[k] = v; if (k === 'top' || k === 'bottom') n.base = 'set'; }
    });
    if (v !== 'none' && v !== 'glasses') { setTarget(k === 'base' ? 'base' : k); setFlash((x) => x + 1); }
  }
  function paint(v) { update((n) => { n.f[tgKey] = v; }); setFlash((x) => x + 1); }
  function step(d) {
    if (tab === 'fabric') {
      const list = COLORS.map(([v]) => v);
      const i = list.indexOf(look.f[tgKey]);
      paint(list[(i + d + list.length) % list.length]);
      return;
    }
    const T = TABS.find((x) => x.k === tab);
    const c = cur(tab) || T.opts[0];
    const i = T.opts.indexOf(c);
    choose(tab, T.opts[(i + d + T.opts.length) % T.opts.length]);
  }
  function onStageClick(e) {
    const p = e.target.closest?.('[data-part]');
    if (!p) return;
    const k = p.getAttribute('data-part');
    if (k === 'none') return;
    setTarget(k);
    setTab('fabric');
    setFlash((x) => x + 1);
  }
  function done() {
    if (!title.trim()) {
      setErr((x) => x + 1);
      titleRef.current?.focus();
      titleRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      return;
    }
    setCover(true);
    if (typeof window !== 'undefined' && window.gtag) window.gtag('event', 'modnyi_kod_look_done');
  }

  const patterns = usedPatterns(look);
  const T = TABS.find((x) => x.k === tab);

  return (
    <div className="mk-studio">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<defs>${DEFS}</defs>` }} />
      <div className="mk-top">
        <input
          ref={titleRef} key={`t${err}`} className={`mk-title${err ? ' err' : ''}`} maxLength={MK.titleMax}
          placeholder="Назви свій образ…" value={title} aria-label="Назва образу"
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="button" className="mk-done" onClick={done}>Готово →</button>
      </div>

      <div className="mk-body">
        <div
          className="mk-stage" onClick={onStageClick}
          onPointerDown={(e) => { swipe.current = e.clientX; }}
          onPointerUp={(e) => {
            if (swipe.current === null) return;
            const dx = e.clientX - swipe.current; swipe.current = null;
            if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
          }}
        >
          {tab === 'fabric' ? <div className="mk-now">Тканина для: {tgName}</div> : null}
          <Svg key={flash} viewBox="0 0 200 440" className="mk-fig" html={lookSvg(look, { live: true, selected: tgKey })} />
          <button type="button" className="mk-arrow l" aria-label="Попередній варіант" onClick={(e) => { e.stopPropagation(); step(-1); }}>‹</button>
          <button type="button" className="mk-arrow r" aria-label="Наступний варіант" onClick={(e) => { e.stopPropagation(); step(1); }}>›</button>
          <div className="mk-hint">Гортай фігурку вбік · тапни річ, щоб змінити тканину</div>
        </div>

        <div className="mk-panel">
          <div className="mk-tray">
            {tab === 'fabric' ? (
              <>
                <button type="button" className="mk-for" onClick={() => { const ks = tg.map(([k]) => k); setTarget(ks[(ks.indexOf(tgKey) + 1) % ks.length]); setFlash((x) => x + 1); }}>для: {tgName} ▾</button>
                {COLORS.map(([v, l]) => (
                  <button key={v} type="button" title={l} aria-label={l} className={`mk-sw${look.f[tgKey] === v ? ' on' : ''}`} onClick={() => paint(v)}><Swatch v={v} /></button>
                ))}
              </>
            ) : T.opts.map((v) => (
              <button key={v} type="button" className={`mk-it${cur(tab) === v ? ' on' : ''}`} onClick={() => choose(tab, v)}>
                <Thumb k={tab} v={v} look={look} /><span>{tab === 'base' ? PIECES.base.opts[v] : PIECES[tab].opts[v]}</span>
              </button>
            ))}
          </div>
          <div className="mk-tabs" role="tablist">
            {TABS.map((x) => (
              <button key={x.k} type="button" role="tab" aria-selected={tab === x.k} className={`mk-tab${tab === x.k ? ' on' : ''}`} onClick={() => setTab(x.k)}>
                <b aria-hidden="true">{x.icon}</b>{x.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {cover ? (
        <div className="mk-cover-wrap" role="dialog" aria-label="Твоя обкладинка">
          <div className="mk-cover-grid">
            <div className="mk-cv">
              <Svg viewBox="0 0 300 400" className="mk-cv-bg" html={`<rect width="300" height="400" fill="${fill(look.f.cover)}"/>`} />
              <div className="mk-cv-in" />
              <div className="mk-cv-logo">dityam.com.ua</div>
              <div className="mk-cv-fig"><Svg viewBox="0 0 200 440" html={lookSvg(look)} /></div>
              <div className="mk-cv-title">{title}</div>
              <div className="mk-cv-badge">МОДНИЙ КОД<b>?/25</b></div>
              <span className="mk-cv-wm" aria-hidden="true">превʼю</span>
            </div>
            <div className="mk-cover-side">
              <h2>Твій образ — на <i>обкладинці!</i></h2>
              <p className="mk-code">{patterns.length ? <>✓ <b>Модний код:</b> у образі є {patterns.join(', ')}.</> : <>Додай хоча б 1 візерунок — шотландку, горох чи леопард.</>}</p>
              <p className="mk-small">Тло обкладинки</p>
              <div className="mk-bgrow">
                {FABRICS.map(([v, l]) => (
                  <button key={v} type="button" title={l} aria-label={l} className={`mk-sw${look.f.cover === v ? ' on' : ''}`} onClick={() => update((n) => { n.f.cover = v; })}><Swatch v={v} /></button>
                ))}
              </div>
              <div className="mk-paid">
                <p className="mk-paid-title">Хочеш справжню обкладинку — без «превʼю» і з твоїми балами?</p>
                <p className="mk-small">Пройди олімпіаду «Модний код»: 25 завдань про кольори, тканини, стилі й тренди. Оргвнесок — {MK.price} грн. Обкладинка для друку А4, сертифікат — і публікуємо її на сайті й у соцмережах.</p>
                {MK.open ? null : <Waitlist />}
              </div>
              <button type="button" className="mk-back" onClick={() => setCover(false)}>← Змінити образ</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
