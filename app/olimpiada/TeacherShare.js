'use client';

// Особисте посилання педагога (11.10.2026): поле з посиланням і «Скопіювати
// посилання», а на сторінці педагога ще й готовий текст для чату класу з
// кнопками Telegram і Viber — як «Поділитися дипломом» (test/ShareDiploma.js).
import { useState } from 'react';
import { teacherLink, teacherInvite } from '@/lib/olimpiada';

export default function TeacherShare({ code, withMessage = false }) {
  const [note, setNote] = useState('');
  const link = teacherLink(code);
  const text = teacherInvite(link);
  const tg = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text.replace(` ${link}`, ''))}`;
  const viber = `viber://forward?text=${encodeURIComponent(text)}`;

  async function copy(value, done) {
    try {
      await navigator.clipboard.writeText(value);
      setNote(done);
    } catch {
      setNote('Не вдалося скопіювати. Виділіть текст вручну.');
    }
    setTimeout(() => setNote(''), 4000);
  }

  return (
    <div className="ol-teach-share">
      <div className="ol-linkrow">
        {/* Не поле вводу: у вузькому полі обрізався саме код у кінці посилання. */}
        <p className="ol-linkbox" aria-label="Ваше посилання для учнів">{link}</p>
        <button type="button" className="ol-btn ol-btn-main" onClick={() => copy(link, 'Посилання скопійовано.')}>Скопіювати посилання</button>
      </div>
      {withMessage && (
        <>
          <p className="ol-teach-label">Готовий текст для чату класу</p>
          <p className="ol-teach-msg">{text}</p>
          <div className="ol-teach-buttons">
            <a className="ol-btn ol-btn-ghost" href={tg} target="_blank" rel="noopener">Telegram</a>
            <a className="ol-btn ol-btn-ghost ol-share-viber" href={viber}>Viber</a>
            <button type="button" className="ol-btn ol-btn-ghost" onClick={() => copy(text, 'Текст скопійовано — вставте його в чат класу.')}>Скопіювати текст</button>
          </div>
        </>
      )}
      {note && <p className="ol-teach-note" role="status">{note}</p>}
    </div>
  );
}
