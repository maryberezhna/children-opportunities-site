'use client';

// «Підтримайте репостом» з готовими текстами постів (Марія, 05.10.2026:
// «а отут ти можеш предефайнити пости»). Telegram і Viber беруть текст
// у посилання самі; Facebook і LinkedIn текст із посилання не приймають
// (беруть лише прев'ю сторінки), тож перед відкриттям копіюємо його в буфер.

import { useState } from 'react';

const URL = 'https://dityam.com.ua/stem-talant';

const POSTS = [
  {
    id: 'parents',
    label: 'Для батьків',
    text: '🚀 STEM-талант України — онлайн-конкурс для школярів 12–17 років!\n\nКод, робот чи дослідження — дитина показує свій проєкт, а журі з інженерів і науковців обирає переможців у 3 номінаціях: програмування й ШІ, робототехніка й інженерія, наука й математика.\n\n📅 Реєстрація 1–20 грудня 2026, проєкти — на зимових канікулах, переможці — 10 січня 2027.',
  },
  {
    id: 'teachers',
    label: 'Для вчителів',
    text: 'Колеги, якщо у вас є учні 12–17 років, які пишуть код, збирають роботів чи проводять дослідження, — розкажіть їм про онлайн-конкурс «STEM-талант України».\n\nРеєстрація 1–20 грудня 2026, проєкти — на зимових канікулах, журі з інженерів і науковців, переможців оголосять 10 січня 2027.',
  },
  {
    id: 'it',
    label: 'Для IT-спільноти',
    text: 'Шукаємо IT-компанії, які хочуть підтримати майбутніх інженерів 🇺🇦\n\nDityam.com.ua проводить «STEM-талант України» — онлайн-конкурс проєктів для школярів 12–17 років на зимових канікулах. Журі — інженери й науковці, призи — від партнерів.\n\nМожна стати генеральним партнером, партнером номінації чи інформаційним партнером — або просто поширити цей пост.',
  },
];

const withUrl = (t) => `${t}\n\n${URL}`;

function track(label) {
  if (typeof window !== 'undefined' && window.gtag) window.gtag('event', 'share_click', { event_label: label });
}

export default function SharePosts() {
  const [active, setActive] = useState(POSTS[0].id);
  const [note, setNote] = useState('');
  const post = POSTS.find((p) => p.id === active) || POSTS[0];

  async function copy(msg) {
    try {
      await navigator.clipboard.writeText(withUrl(post.text));
      setNote(msg);
    } catch {
      setNote('Не вдалося скопіювати — виділіть текст вище й скопіюйте вручну.');
    }
    setTimeout(() => setNote(''), 4000);
  }

  async function openWithCopy(href, network) {
    track(`stem_talant_${network}_${post.id}`);
    await copy('Текст скопійовано — вставте його в пост.');
    window.open(href, '_blank', 'noopener,noreferrer');
  }

  const tg = `https://t.me/share/url?url=${encodeURIComponent(URL)}&text=${encodeURIComponent(post.text)}`;
  const viber = `viber://forward?text=${encodeURIComponent(withUrl(post.text))}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL)}`;
  const li = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(URL)}`;

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
      <p className="st-post-text" role="tabpanel">{withUrl(post.text)}</p>
      <div className="st-share-btns">
        <button type="button" className="st-share-btn st-share-copy-btn"
          onClick={() => { track(`stem_talant_copy_${post.id}`); copy('Текст поста скопійовано ✓'); }}>
          Скопіювати текст
        </button>
        <a href={tg} className="st-share-btn" target="_blank" rel="noopener noreferrer"
          onClick={() => track(`stem_talant_telegram_${post.id}`)}>Telegram</a>
        <a href={viber} className="st-share-btn"
          onClick={() => track(`stem_talant_viber_${post.id}`)}>Viber</a>
        <button type="button" className="st-share-btn" onClick={() => openWithCopy(fb, 'facebook')}>Facebook</button>
        <button type="button" className="st-share-btn" onClick={() => openWithCopy(li, 'linkedin')}>LinkedIn</button>
      </div>
      <p className="st-posts-note" aria-live="polite">{note}</p>
    </div>
  );
}
