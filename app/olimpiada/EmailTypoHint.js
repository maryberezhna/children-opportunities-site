'use client';

// Підказка під полем email: «Можливо, ви мали на увазі …@gmail.com?» + «Виправити»
// (11.10.2026: приблизно кожен 9-й з батьків помилився в домені, і листи
// поверталися). Перевіряємо, коли людина виходить із поля, і ще раз при
// відправці. Відправку з підказкою зупиняємо лише раз: удруге з тією самою
// адресою форма йде далі — незвичний домен може бути справжнім.
// Адресу самі не міняємо ніколи: лише кнопкою «Виправити».
import { useId, useRef, useState } from 'react';
import { suggestEmail } from '@/lib/email-typo';
import { sendSiteEvent, SITE_EVENTS } from '@/lib/site-events';

/** where — яка форма (entry, teacher, waitlist): мітка для лічильника. */
export function useEmailTypo(where) {
  const inputRef = useRef(null);
  const fixRef = useRef(null);
  const warned = useRef(null); // адреса, з якою відправку вже раз зупинили
  const [hint, setHint] = useState(null); // { from, to }
  const id = useId();

  const current = () => String(inputRef.current?.value || '').trim();

  function check() {
    const value = current();
    const to = suggestEmail(value);
    setHint(to ? { from: value, to } : null);
    return to;
  }

  /** true — відправку зупинити й показати підказку; удруге з тією самою адресою — false. */
  function blockSubmit() {
    if (!check()) return false;
    const value = current();
    if (warned.current === value) return false;
    warned.current = value;
    setTimeout(() => fixRef.current?.focus(), 0);
    return true;
  }

  function fix() {
    if (!hint || !inputRef.current) return;
    inputRef.current.value = hint.to;
    setHint(null);
    sendSiteEvent(SITE_EVENTS.OLIMP_EMAIL_TYPO_FIXED, where);
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'olimpiada_email_typo_fixed', { event_label: where });
    }
    inputRef.current.focus();
  }

  const inputProps = {
    ref: inputRef,
    onBlur: check,
    // Людина виправляє сама — стара підказка вже не про цю адресу.
    onInput: () => { if (hint && current() !== hint.from) setHint(null); },
    'aria-describedby': hint ? id : undefined,
  };

  const hintNode = <EmailTypoHint id={id} hint={hint} onFix={fix} fixRef={fixRef} />;
  return { inputProps, hintNode, blockSubmit };
}

function EmailTypoHint({ id, hint, onFix, fixRef }) {
  // Живий регіон стоїть завжди, а змінюється лише вміст — так читачі екрана
  // справді озвучують підказку, коли вона зʼявляється.
  return (
    <div className="ol-typo-live" aria-live="polite">
      {hint && (
        <p className="ol-typo">
          <span id={id}>Можливо, ви мали на увазі <b>{hint.to}</b>?</span>{' '}
          <button type="button" className="ol-typo-fix" ref={fixRef} onClick={onFix} aria-describedby={id}>
            Виправити
          </button>
        </p>
      )}
    </div>
  );
}
