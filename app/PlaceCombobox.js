'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { filterPlaces, matchRange } from '@/lib/place-search';

// Поле «Де» з підказками (Марія 27.09.2026: «оце треба переробити на зручний
// ручний ввід»). До того тут був рідний <select> з онлайном, закордоном і
// десятками міст — щоб дійти до потрібного, його довго гортали.
//
// Один компонент на три місця: бічна панель десктопа, рядок фільтрів
// (901–1099px і /en) і мобільна шторка. Обране місце компонент не показує —
// це робить сторінка там, де воно показувалось і раніше (пункти з ✕, чипи).
// Він лише пропонує ще не обране і віддає вибір через onPick.
//
// Доступність — патерн combobox із WAI-ARIA APG: фокус лишається в полі,
// активний пункт — aria-activedescendant; ↑/↓ ходять, Enter обирає, Esc
// закриває, Tab іде далі.

// Вісім рядків по 36px і поля — далі список прокручується.
const MAX_H = 8 * 36 + 8;

// useLayoutEffect на сервері лише попереджає в консоль — там він і не потрібен.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function scrollParent(el) {
  for (let p = el?.parentElement; p && p !== document.body; p = p.parentElement) {
    const { overflowY } = window.getComputedStyle(p);
    if (overflowY === 'auto' || overflowY === 'scroll') return p;
  }
  return null;
}

function Highlight({ label, query }) {
  const r = matchRange(label, query);
  if (!r) return label;
  return (
    <>
      {label.slice(0, r[0])}
      <b>{label.slice(r[0], r[1])}</b>
      {label.slice(r[1])}
    </>
  );
}

export default function PlaceCombobox({
  id,
  options,
  counts = null,
  chosen = [],
  onPick,
  placeholder,
  emptyText,
  // Шторка: види місця вже стоять чипами над полем — на порожньому полі їх
  // не дублюємо, але вписане «онлайн» знаходиться.
  kindsWhenEmpty = true,
  // Шторка: список у потоці під полем, а не поверх, — прокручується разом зі
  // шторкою і не вилазить за її край.
  inline = false,
  className = '',
  // Імʼя поля: або видимий підпис (labelId — id елемента з ним; поле тоді
  // має <label htmlFor> або aria-labelledby на сторінці), або aria-label.
  labelId,
  ariaLabel,
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState({ up: false, max: MAX_H });
  // Шторка: висота, яку поле зі списком зайняло при відкритті. Поки список
  // відкритий, місце тримаємо — інакше з кожною літерою список коротшав би,
  // шторка докручувалась назад і поле стрибало б під пальцем.
  const [reserve, setReserve] = useState(0);
  const reserveTimer = useRef(0);
  useEffect(() => () => clearTimeout(reserveTimer.current), []);
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const popRef = useRef(null);

  const results = useMemo(
    () => filterPlaces(options, text, { counts: counts || {}, exclude: chosen, kindsWhenEmpty }),
    [options, text, counts, chosen, kindsWhenEmpty],
  );
  const typed = text.trim() !== '';
  const showPop = open && (results.length > 0 || typed);
  const expanded = open && results.length > 0;
  const listId = `${id}-list`;
  const optId = (i) => `${id}-opt-${i}`;
  const cur = active < results.length ? active : -1;

  // Закрити й забути недописане: текст без вибору нічого не фільтрує, і
  // «ки» в полі після виходу з нього виглядало б як обраний фільтр.
  const close = () => {
    setOpen(false);
    setActive(-1);
    setText('');
  };

  // Клік чи дотик поза полем закриває список. Blur сам не завжди приходить:
  // на iOS дотик до неклікабельного місця фокус із поля не знімає.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) close();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Куди розкривати. Бічна панель прокручується всередині, і «Де» в ній
  // остання: список донизу впирався б у її край. Тоді розкриваємо вгору,
  // поверх інших груп. Перераховуємо, лише коли поле зсувається (прокрутка,
  // клавіатура телефона), а не з кожною літерою — щоб список не стрибав.
  useIsoLayoutEffect(() => {
    if (!open) return undefined;
    const input = inputRef.current;
    if (!input) return undefined;
    const sp = scrollParent(rootRef.current);
    if (inline) {
      // Шторка: підкрутити її вміст так, щоб список під полем було видно,
      // але саме поле не пішло за верхній край.
      const pop = popRef.current;
      if (!sp || !pop) return undefined;
      const pr = sp.getBoundingClientRect();
      const over = pop.getBoundingClientRect().bottom + 12 - pr.bottom;
      const room = input.getBoundingClientRect().top - pr.top - 8;
      if (over > 0 && room > 0) sp.scrollTop += Math.min(over, room);
      clearTimeout(reserveTimer.current);
      setReserve(rootRef.current?.offsetHeight || 0);
      // Відпускаємо місце не одразу: список закривається вже на pointerdown
      // поза ним, і якби шторка тієї ж миті докрутилась назад, чип, до якого
      // людина тягнулась, поїхав би з-під пальця ще до click.
      return () => {
        reserveTimer.current = setTimeout(() => setReserve(0), 400);
      };
    }
    let raf = 0;
    const measure = () => {
      raf = 0;
      const r = input.getBoundingClientRect();
      const vv = window.visualViewport;
      let top = vv ? vv.offsetTop : 0;
      let bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
      if (sp) {
        const pr = sp.getBoundingClientRect();
        top = Math.max(top, pr.top);
        bottom = Math.min(bottom, pr.bottom);
      }
      const below = bottom - r.bottom - 12;
      const above = r.top - top - 12;
      const up = below < MAX_H && above > below;
      const max = Math.round(Math.max(120, Math.min(MAX_H, up ? above : below)));
      setPlace((prev) => (prev.up === up && prev.max === max ? prev : { up, max }));
    };
    measure();
    const onMove = () => { if (!raf) raf = requestAnimationFrame(measure); };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    window.visualViewport?.addEventListener('resize', onMove);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      window.visualViewport?.removeEventListener('resize', onMove);
    };
  }, [open, inline]);

  // Активний пункт завжди видно: прокручуємо лише сам список, не сторінку.
  useEffect(() => {
    const list = listRef.current;
    if (!expanded || cur < 0 || !list) return;
    const el = list.children[cur];
    if (!el) return;
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
    }
  }, [cur, expanded]);

  const pick = (o) => {
    onPick(o.value);
    setText('');
    setActive(-1);
    setOpen(false);
    // Фокус лишається в полі — можна одразу вписати наступне місце.
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    const n = results.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(e.key === 'ArrowDown' ? 0 : n - 1);
        return;
      }
      if (!n) return;
      if (e.key === 'ArrowDown') setActive(cur < 0 || cur >= n - 1 ? 0 : cur + 1);
      else setActive(cur <= 0 ? n - 1 : cur - 1);
    } else if (e.key === 'Enter') {
      if (!showPop) return;
      e.preventDefault();
      if (cur >= 0 && results[cur]) pick(results[cur]);
    } else if (e.key === 'Escape') {
      if (open) {
        // Лише список: шторка слухає Esc на window і закрилась би разом із ним.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
      } else if (text) {
        e.stopPropagation();
        setText('');
      }
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`pc${inline ? ' pc--inline' : ''}${showPop ? ' is-open' : ''} ${className}`.trim()}
      style={inline && reserve ? { minHeight: reserve } : undefined}
    >
      <input
        ref={inputRef}
        id={id}
        className="pc-input"
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded && cur >= 0 ? optId(cur) : undefined}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          // З текстом перший пункт одразу активний — Enter його й обере.
          setActive(e.target.value.trim() ? 0 : -1);
          if (listRef.current) listRef.current.scrollTop = 0;
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      {showPop ? (
        <div
          ref={popRef}
          className={`pc-pop${!inline && place.up ? ' is-up' : ''}`}
          style={inline ? undefined : { '--pc-max': `${place.max}px` }}
          // Натискання в списку не забирає фокус із поля: інакше blur закрив
          // би список раніше, ніж спрацює клік по пункту.
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.length ? (
            <ul
              ref={listRef}
              id={listId}
              className="pc-list"
              role="listbox"
              aria-labelledby={labelId}
              aria-label={labelId ? undefined : ariaLabel}
            >
              {results.map((o, i) => (
                <li
                  key={o.value}
                  id={optId(i)}
                  role="option"
                  aria-selected={i === cur}
                  className={`pc-opt${i === cur ? ' is-active' : ''}`}
                  onClick={() => pick(o)}
                  onMouseMove={() => { if (i !== cur) setActive(i); }}
                >
                  <span className="pc-label"><Highlight label={o.label} query={text} /></span>
                  {counts && counts[o.value] != null ? (
                    <span className="pc-n">{counts[o.value]}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="pc-empty" role="status">{emptyText}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
