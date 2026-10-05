'use client';

// «Підтримайте репостом» з готовими текстами постів (Марія, 05.10.2026:
// «а отут ти можеш предефайнити пости»). Telegram і Viber беруть текст
// у посилання самі. LinkedIn — через feed/?shareActive=true&text=… (недокументовано,
// тож текст ще й копіюємо в буфер). Facebook текст із посилання не приймає
// з 2017 року — лише копія в буфер і помітна підказка «вставте».

import { useState } from 'react';

// Батькам і вчителям — /stem-talant (у грудні там буде сторінка для дітей,
// до того вона веде на /stem-partnery); IT-спільноті — одразу сторінка партнерів.
const KIDS_URL = 'https://dityam.com.ua/stem-talant';
const PARTNERS_URL = 'https://dityam.com.ua/stem-partnery';

const POSTS = [
  {
    id: 'parents',
    url: KIDS_URL,
    label: 'Для батьків',
    text: '🚀 STEM-талант України — онлайн-конкурс для українських школярів 12–17 років з усього світу!\n\nКод, робот чи дослідження — дитина показує свій проєкт, а журі з інженерів і науковців обирає переможців у 3 номінаціях: програмування й ШІ, робототехніка й інженерія, наука й математика.\n\n📅 Реєстрація 1–20 грудня 2026, проєкти — на зимових канікулах, переможці — 10 січня 2027.',
  },
  {
    id: 'teachers',
    url: KIDS_URL,
    label: 'Для вчителів',
    text: 'Колеги, якщо у вас є учні 12–17 років, які пишуть код, збирають роботів чи проводять дослідження, — розкажіть їм про онлайн-конкурс «STEM-талант України».\n\nРеєстрація 1–20 грудня 2026, проєкти — на зимових канікулах, журі з інженерів і науковців, переможців оголосять 10 січня 2027.',
  },
  {
    id: 'it',
    url: PARTNERS_URL,
    label: 'Для IT-спільноти',
    text: 'Шукаємо IT-компанії, які хочуть підтримати майбутніх інженерів 🇺🇦\n\nDityam.com.ua проводить «STEM-талант України» — онлайн-конкурс проєктів для українських школярів 12–17 років з усього світу на зимових канікулах. Журі — інженери й науковці, призи — від партнерів.\n\nМожна стати генеральним партнером, партнером номінації чи інформаційним партнером — або просто поширити цей пост.',
  },
];

const withUrl = (p) => `${p.text}\n\n${p.url}`;

function track(label) {
  if (typeof window !== 'undefined' && window.gtag) window.gtag('event', 'share_click', { event_label: label });
}

export default function SharePosts() {
  const [active, setActive] = useState(POSTS[0].id);
  const [note, setNote] = useState('');
  const post = POSTS.find((p) => p.id === active) || POSTS[0];

  async function copy(msg) {
    try {
      await navigator.clipboard.writeText(withUrl(post));
      setNote(msg);
    } catch {
      setNote('Не вдалося скопіювати — виділіть текст вище й скопіюйте вручну.');
    }
    setTimeout(() => setNote(''), 9000);
  }

  async function openWithCopy(href, network, msg) {
    track(`stem_talant_${network}_${post.id}`);
    await copy(msg);
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  const tg = `https://t.me/share/url?url=${encodeURIComponent(post.url)}&text=${encodeURIComponent(post.text)}`;
  const viber = `viber://forward?text=${encodeURIComponent(withUrl(post))}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(post.url)}`;
  const li = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(withUrl(post))}`;

  return (
    <div className="st-posts">
      <div className="st-posts-tabs" role="tablist" aria-label="Готовий текст поста">
        {POSTS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === active}
            className={p.id === active ? 'is-on' : ''}
            onClick={() => { setActive(p.id); setNote(''); }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="st-post-text" role="tabpanel">{withUrl(post)}</p>
      <div className="st-share-btns">
        <button type="button" className="st-share-btn st-share-copy-btn"
          onClick={() => { track(`stem_talant_copy_${post.id}`); copy('Текст поста скопійовано ✓'); }}>
          Скопіювати текст
        </button>
        <a href={tg} className="st-share-btn" target="_blank" rel="noopener noreferrer"
          onClick={() => track(`stem_talant_telegram_${post.id}`)}>Telegram</a>
        <a href={viber} className="st-share-btn"
          onClick={() => track(`stem_talant_viber_${post.id}`)}>Viber</a>
        <button type="button" className="st-share-btn" onClick={() => openWithCopy(fb, 'facebook', 'Текст скопійовано ✓ Facebook не дозволяє вставити його сам — натисніть у полі поста Ctrl+V (на Mac — ⌘+V).')}>Facebook</button>
        <button type="button" className="st-share-btn" onClick={() => openWithCopy(li, 'linkedin', 'Текст уже в пості LinkedIn. Якщо поле порожнє — він скопійований: вставте Ctrl+V (на Mac — ⌘+V).')}>LinkedIn</button>
      </div>
      <p className={note ? 'st-posts-note is-on' : 'st-posts-note'} aria-live="polite">{note}</p>
    </div>
  );
}
