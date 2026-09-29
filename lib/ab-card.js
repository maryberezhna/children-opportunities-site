// A/B-тест картки можливості (29.09.2026): A — картка як була, B — нова за
// макетом «Dityam — редизайн каталогу» (вік першим, деталі блоком, опис у
// два рядки, на телефоні дедлайн і «Детальніше» одним рядком унизу).
//
// Варіант живе в cookie `ab_card` і застосовується В БРАУЗЕРІ: inline-скрипт
// на початку <body> (app/layout.js) читає cookie й ставить data-ab-card на
// <html>, а CSS у app/styles/cards.css показує потрібний вигляд. Так само
// вже працює режим «Підліткам» (data-mode).
//
// Чому не на сервері. Головна, підбірки й сторінки можливостей віддаються з
// кешу ISR, і cookies() у серверному компоненті зробила б їх динамічними:
// кожен візит ішов би в Supabase (CLAUDE.md, «Каталог і база»). HTML один
// для всіх, різниться лише CSS, тож кеш Vercel не роздвоюється.
//
// Розподіл 50/50 ставить middleware (окремий PR). До нього cookie ставить
// лише адреса з ?ab_card=B — для перевірки й знімків. Без cookie всі бачать A.
export const AB_CARD_COOKIE = 'ab_card';
export const AB_CARD_VARIANTS = ['A', 'B'];
export const AB_CARD_MAX_AGE = 90 * 24 * 3600; // 90 днів: тест триває ≥ 4 тижні

/** Варіант із рядка cookie (document.cookie чи заголовка Cookie), інакше null. */
export function abCardFromCookie(cookieString) {
  const m = /(?:^|;\s*)ab_card=(A|B)(?:;|$)/.exec(String(cookieString || ''));
  return m ? m[1] : null;
}

/** Варіант із пошукового рядка адреси (?ab_card=B), інакше null. */
export function abCardFromSearch(search) {
  const m = /(?:^\??|[?&])ab_card=(A|B)(?:&|$)/.exec(String(search || ''));
  return m ? m[1] : null;
}

// Перший скрипт у <body>: виконується до того, як браузер розбере решту
// сторінки, тож картка одразу малюється потрібним варіантом, без стрибка.
// Ім'я cookie і термін тут дослівно ті самі, що в константах вище — тест
// tests/ab-card.test.mjs це звіряє.
export const AB_CARD_BOOT_SCRIPT = `(function(){try{
var m=/(?:^\\??|[?&])ab_card=(A|B)(?:&|$)/.exec(location.search);
var v=m?m[1]:null;
if(v){document.cookie='ab_card='+v+';path=/;max-age=${AB_CARD_MAX_AGE};samesite=lax'}
else{var c=/(?:^|;\\s*)ab_card=(A|B)(?:;|$)/.exec(document.cookie);v=c?c[1]:null}
if(v==='B'){document.documentElement.setAttribute('data-ab-card','B')}
}catch(e){}})();`;
