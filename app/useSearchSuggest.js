'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  suggest, subscribeSuggestSource, getSuggestSource, getServerSuggestSource,
} from '@/lib/search-suggest';
import { TYPE_LABELS, TYPE_LABELS_EN } from '@/lib/labels';
import { trackSearchSuggest } from '@/lib/track';

// Підказки під полем пошуку: дописані слова й до чотирьох записів
// (lib/search-suggest.js). Хук, а не компонент: три поля пошуку (хіро
// головної, бічна панель каталогу, телефон) мають різну розмітку навколо
// <input>, і кожне лишає свою. Хук віддає атрибути для поля й список, який
// поле ставить поруч із собою.
//
// Доступність — той самий патерн combobox, що й у полі «Де»
// (app/PlaceCombobox.js): фокус лишається в полі, ↑/↓ ходять по пунктах,
// Enter обирає, Esc закриває. Без вибраного пункту Enter робить те, що й
// раніше (у хіро — «Знайти»).

const T = {
  uk: { words: 'Пошукати', records: 'Можливості', list: 'Підказки пошуку' },
  en: { words: 'Search for', records: 'Opportunities', list: 'Search suggestions' },
};

export default function useSearchSuggest({ id, value, onPickWord, lang = 'uk' }) {
  const source = useSyncExternalStore(subscribeSuggestSource, getSuggestSource, getServerSuggestSource);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const focused = useRef(false);
  const t = T[lang] || T.uk;
  const types = lang === 'en' ? TYPE_LABELS_EN : TYPE_LABELS;

  // Людина друкує — список відкривається й починає з нуля.
  useEffect(() => {
    if (!focused.current) return;
    setOpen(true);
    setActive(-1);
  }, [value]);

  const found = useMemo(
    () => (open && source ? suggest(value, source) : { words: [], records: [] }),
    [open, source, value],
  );
  const options = useMemo(() => [
    ...found.words.map((w) => ({ kind: 'word', key: `w:${w.text}`, ...w })),
    ...found.records.map((r) => ({
      kind: 'record',
      key: `r:${r.id}`,
      title: (lang === 'en' && r.title_en) || r.title,
      type: types[r.opportunity_type] || '',
      href: `${lang === 'en' ? '/en' : ''}/o/${r.slug}`,
    })),
  ], [found, lang, types]);

  const listId = `${id}-suggest`;
  const optId = (i) => `${id}-suggest-${i}`;
  const expanded = open && options.length > 0;
  const cur = active < options.length ? active : -1;

  const close = () => { setOpen(false); setActive(-1); };

  const pick = (o) => {
    close();
    if (o.kind === 'word') {
      trackSearchSuggest('word', o.text);
      onPickWord(o.text);
    } else {
      trackSearchSuggest('record', value);
      router.push(o.href);
    }
  };

  const onKeyDown = (e) => {
    const n = options.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!n) return;
      e.preventDefault();
      setOpen(true);
      if (e.key === 'ArrowDown') setActive(cur < 0 || cur >= n - 1 ? 0 : cur + 1);
      else setActive(cur <= 0 ? n - 1 : cur - 1);
    } else if (e.key === 'Enter') {
      if (expanded && cur >= 0) {
        e.preventDefault();
        pick(options[cur]);
      } else {
        close();
      }
    } else if (e.key === 'Escape') {
      if (expanded) {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const inputProps = {
    role: 'combobox',
    'aria-expanded': expanded,
    'aria-controls': listId,
    'aria-autocomplete': 'list',
    'aria-activedescendant': expanded && cur >= 0 ? optId(cur) : undefined,
    autoComplete: 'off',
    onKeyDown,
    onFocus: () => { focused.current = true; if (value.trim()) setOpen(true); },
    onBlur: () => { focused.current = false; close(); },
  };

  const firstRecord = options.findIndex((o) => o.kind === 'record');
  const typedLen = (w) => Math.max(0, value.length - w.head.length);

  const popup = expanded ? (
    <div
      className="ss-pop"
      // Натискання в списку не забирає фокус із поля: інакше blur закрив би
      // список раніше, ніж спрацює клік по пункту.
      onMouseDown={(e) => e.preventDefault()}
    >
      <ul id={listId} className="ss-list" role="listbox" aria-label={t.list}>
        {options.map((o, i) => (
          <li key={o.key} role="none" className="ss-row">
            {i === 0 && o.kind === 'word' ? <span className="ss-head" aria-hidden="true">{t.words}</span> : null}
            {i === firstRecord ? <span className="ss-head" aria-hidden="true">{t.records}</span> : null}
            <div
              id={optId(i)}
              role="option"
              aria-selected={i === cur}
              className={`ss-opt ss-${o.kind}${i === cur ? ' is-active' : ''}`}
              onClick={() => pick(o)}
              onMouseMove={() => { if (i !== cur) setActive(i); }}
            >
              {o.kind === 'word' ? (
                <>
                  <span className="ss-text">
                    {o.head}
                    {o.word.toLowerCase().startsWith(value.slice(o.head.length).toLowerCase())
                      ? <>{o.word.slice(0, typedLen(o))}<b>{o.word.slice(typedLen(o))}</b></>
                      : <b>{o.word}</b>}
                  </span>
                  <span className="ss-n">{o.n}</span>
                </>
              ) : (
                <>
                  <span className="ss-text">{o.title}</span>
                  {o.type ? <span className="ss-type">{o.type}</span> : null}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  return { inputProps, popup };
}
