import { createClient } from '@supabase/supabase-js';

/**
 * Спільне меню адмінки.
 *
 * Досі навігація була розсипана по сторінках: на /admin — два посилання в
 * заголовку, на /admin/messages — інші два, на /admin/metrics — одне назад,
 * а на /admin/edit/[id] не було жодного, тож із редагування вийти можна було
 * тільки кнопкою «назад» у браузері. Тепер меню одне на всі сторінки, і
 * воно ще й показує, де саме на тебе чекає робота: число біля «Черги» і
 * «Звернень» видно з будь-якої сторінки.
 *
 * Лічильники рахуються тут, а не передаються пропсами: сторінка не має
 * знати, що потрібно меню, і жодна нова сторінка не забуде їх передати.
 *
 * Вигляд (15.09.2026, «зроби у адмінці нормальну навігацію»): один рядок —
 * назва ліворуч, розділи посередині, «Бот» і «Сайт» праворуч за роздільником.
 * Раніше це були кнопки з рамками, які не вміщались і переносились на другий
 * рядок. Тепер розділи, що не влазять, гортаються вбік, а сама панель липка:
 * лишається вгорі, коли гортаєш довгу чергу.
 */

// Той самий бот, що веде чергу модерації (webhook у app/api/telegram).
// ?start=queue відкриває бота одразу на наступному кандидаті.
export const BOT_URL = 'https://t.me/DityamComUABot';
export const BOT_QUEUE_URL = `${BOT_URL}?start=queue`;

// Контраст як на сайті: білий текст на #c8501a (4,7:1), сірий #6b6b6b.
// Брендовий #e85d24 і #8a95a9 не проходили WCAG AA.
const C = {
  ink: '#131b28', ink2: '#54617a', ink3: '#6b6b6b',
  border: '#e2e8f2', bg: '#f1f4f9', accent: '#c8501a', link: '#1e4fd6',
};

// Пункти — за справами, а не за таблицями (15.09.2026). «Дітям захисників»
// вийшла з меню: це частина черги, і на «Сьогодні» є окремий рядок із
// переходом на /admin/zakhysnyky.
const ITEMS = [
  { key: 'today', href: '/admin/today', icon: '☀️', label: 'Сьогодні' },
  // Черга — уся модерація в одному місці: сирі знахідки, кандидати й те, що
  // вже на сайті, вкладками в порядку шляху (22.09.2026). Окремий «Карантин»
  // прибрано: два пункти меню на два кроки одного шляху читались як дві різні
  // системи, і сирі знахідки лишались нерозібраними.
  { key: 'queue', href: '/admin', icon: '🗂', label: 'Черга', count: 'queue' },
  // Те саме, що бачить другий адміністратор: лише готові чернетки й три
  // кнопки. Марії — щоб глянути його очима, йому — єдина потрібна сторінка.
  { key: 'cherga', href: '/admin/cherga', icon: '✅', label: 'Схвалення' },
  { key: 'messages', href: '/admin/messages', icon: '✉️', label: 'Звернення', count: 'messages' },
  // Підписники, оформлення, оплати й список очікування (15.09.2026).
  { key: 'plus', href: '/admin/plus', icon: '💎', label: 'Dityam+' },
  { key: 'metrics', href: '/admin/metrics', icon: '📈', label: 'Метрики' },
];

// Стилі класами, а не інлайном: інлайн не вміє :hover, фокус і вузький екран.
const CSS = `
.adm-nav {
  /* Ширину панелі задає сторінка (980px, а форма редагування — 640px), тож
     стискаємо пункти за шириною самої панелі, а не вікна. */
  container-type: inline-size;
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 10px;
  margin: 0 0 20px; padding: 6px;
  background: rgba(255, 255, 255, 0.94);
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  border: 1px solid ${C.border}; border-radius: 14px;
  box-shadow: 0 1px 3px rgba(19, 27, 40, 0.05);
}
.adm-brand {
  flex: none; padding: 0 12px 0 8px; border-right: 1px solid ${C.border};
  font-size: 14px; font-weight: 800; letter-spacing: -0.01em; line-height: 36px;
  color: ${C.ink}; text-decoration: none; white-space: nowrap;
}
.adm-tabs {
  flex: 1; min-width: 0; display: flex; gap: 2px;
  overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch;
}
.adm-tabs::-webkit-scrollbar { display: none; }
.adm-tab {
  flex: none; display: inline-flex; align-items: center; gap: 6px;
  height: 36px; padding: 0 11px; border-radius: 9px;
  font-size: 14px; font-weight: 600; color: ${C.ink2};
  text-decoration: none; white-space: nowrap;
}
.adm-tab:hover { background: ${C.bg}; color: ${C.ink}; }
.adm-tab[aria-current="page"] { background: ${C.ink}; color: #fff; }
.adm-ico { font-size: 15px; line-height: 1; }
.adm-badge {
  min-width: 20px; padding: 0 6px; border-radius: 20px;
  font-size: 12px; font-weight: 700; line-height: 20px; text-align: center;
  background: ${C.accent}; color: #fff; font-variant-numeric: tabular-nums;
}
.adm-tab[aria-current="page"] .adm-badge { background: #fff; color: ${C.accent}; }
.adm-side {
  flex: none; display: flex; align-items: center; gap: 2px;
  padding-left: 8px; border-left: 1px solid ${C.border};
}
.adm-ext {
  display: inline-flex; align-items: center; height: 36px; padding: 0 10px;
  border-radius: 9px; font-size: 13px; font-weight: 600;
  text-decoration: none; white-space: nowrap;
}
.adm-ext:hover { background: ${C.bg}; }
.adm-bot { color: ${C.link}; }
.adm-site { color: ${C.ink3}; }
.adm-nav a:focus-visible { outline: 2px solid ${C.link}; outline-offset: 2px; }
@container (max-width: 720px) {
  .adm-brand, .adm-site, .adm-ico { display: none; }
  .adm-side { padding-left: 6px; }
  /* Розділи не влазять і гортаються вбік — затухання праворуч підказує, що
     там є ще. */
  .adm-tabs {
    -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
    mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
  }
}
`;

const SCROLL_TO_CURRENT = `(function () {
  var nav = document.currentScript && document.currentScript.parentNode;
  var tabs = nav && nav.querySelector('.adm-tabs');
  var on = tabs && tabs.querySelector('[aria-current="page"]');
  if (!on || tabs.scrollWidth <= tabs.clientWidth) return;
  // Гортаємо лише тоді, коли активний розділ за правим краєм (або під
  // затуханням), і рівно настільки, щоб його стало видно. Інакше рядок
  // зсувався навіть для другого пункту й обрізав перший.
  var right = on.offsetLeft + on.offsetWidth;
  var edge = tabs.offsetLeft + tabs.clientWidth - 32;
  if (right > edge) tabs.scrollLeft = right - edge;
})();`;

async function counts() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {};
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const head = (table, filter) => filter(
    supabase.from(table).select('id', { count: 'exact', head: true }),
  );
  try {
    const [drafts, msgs, sugs, quar] = await Promise.all([
      head('opportunities', (q) => q.eq('status', 'draft')),
      head('contact_messages', (q) => q.eq('status', 'new')),
      // Лише ті пропозиції, що чекають на людину. Було «все, крім done», а
      // process_suggestions.py ставить imported / duplicate, не done: число
      // ніколи не зменшувалось (18 при 7 справжніх, 15.09.2026).
      head('opportunity_suggestions', (q) => q.in('status', ['new', 'needs_human'])),
      head('raw_items', (q) => q.eq('status', 'review').is('review_verdict', null)),
    ]);
    return {
      // Одне число на всю чергу: кандидати плюс сирі знахідки, бо це одна
      // робота на одній сторінці.
      queue: (drafts.count ?? 0) + (quar.count ?? 0),
      drafts: drafts.count ?? 0,
      // Звернення з форми і пропозиції з поп-апа лежать у двох таблицях, але
      // для Марії це одна пошта — на /admin/messages вони вже злиті в один
      // список, тож і цифра має бути одна.
      messages: (msgs.count ?? 0) + (sugs.count ?? 0),
    };
  } catch {
    // Лічильник — не привід впасти всій сторінці: без нього меню лишається
    // меню, просто без чисел.
    return {};
  }
}

export default async function AdminNav({ current }) {
  const n = await counts();

  return (
    <nav className="adm-nav" aria-label="Адмінка">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <a href="/admin/today" className="adm-brand">Dityam.com.ua</a>

      <div className="adm-tabs">
        {ITEMS.map((it) => {
          const count = it.count ? n[it.count] : 0;
          return (
            <a
              key={it.key}
              href={it.href}
              className="adm-tab"
              aria-current={it.key === current ? 'page' : undefined}
            >
              <span className="adm-ico" aria-hidden="true">{it.icon}</span>
              {it.label}
              {count ? <span className="adm-badge">{count}</span> : null}
            </a>
          );
        })}
      </div>
      {/* На вузькому екрані активний розділ може стояти за краєм рядка
          (наприклад, «Метрики» з телефона) — одразу прокручуємо до нього.
          Лише scrollLeft рядка: сторінку по вертикалі не чіпаємо. */}
      <script dangerouslySetInnerHTML={{ __html: SCROLL_TO_CURRENT }} />

      <div className="adm-side">
        {/* Бот — не «ще одне посилання», а другий вхід у ту саму роботу:
            модерувати з телефона швидше в ньому, ніж у браузері. */}
        <a
          href={BOT_QUEUE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="adm-ext adm-bot"
          title="Модерувати в Telegram-боті"
        >
          🤖 Бот ↗
        </a>
        <a href="/" target="_blank" rel="noopener noreferrer" className="adm-ext adm-site">
          Сайт ↗
        </a>
      </div>
    </nav>
  );
}
