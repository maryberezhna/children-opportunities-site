/**
 * Один опис того, кого ми вважаємо україномовним.
 *
 * Ним користуються двоє: середник (за заголовком Accept-Language) вирішує,
 * чи відправляти людину на /en, і банер LangSuggest (за navigator.languages)
 * вирішує, чи пропонувати англійську. Доки визначення було в кожного своє,
 * вони суперечили одне одному: середник міг забрати людину на англійську
 * сторінку, а банер на ній — запропонувати те саме ще раз.
 *
 * Дивимось увесь список, а не лише перший запис: у діаспори браузер часто
 * встановлений мовою країни («pl-PL,pl,uk»), і українська стоїть третьою.
 * Саме таких людей редірект не має чіпати.
 */
export function readsUkrainian(tags) {
  return (tags || []).some((tag) => {
    const t = String(tag || '').toLowerCase().trim();
    return t === 'uk' || t.startsWith('uk-') || t === 'ru' || t.startsWith('ru-');
  });
}

/** Accept-Language → перелік мовних тегів, без тих, від яких браузер відмовився (q=0). */
export function acceptLanguageTags(header) {
  return String(header || '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      return { tag: tag.trim(), q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((x) => x.tag && Number.isFinite(x.q) && x.q > 0)
    .map((x) => x.tag);
}

/** Сторінка англійської версії: /en і все під ним. */
export const isEnglishPath = (p) => p === '/en' || String(p || '').startsWith('/en/');

/**
 * Чи пропонувати іншу мовну версію і яку: 'to_en', 'to_uk' або null.
 *
 * До 30.09.2026 пропозиція існувала лише в бік англійської. Зворотного
 * випадку не було, хоча саме він масовий: за 28 днів на англійські сторінки
 * зайшли 326 разів, із них 103 з ChatGPT, а 81% трафіку з ChatGPT — з
 * України. Тобто україномовна людина потрапляла на англійську сторінку й
 * жодної підказки не бачила.
 *
 * `uaReader` — null, доки браузер не перевірено: тоді не пропонуємо нічого,
 * щоб банер не блимнув не тією мовою.
 */
export function langSuggestion({ pathname, uaReader }) {
  const p = pathname || '/';
  if (uaReader === null || uaReader === undefined) return null;
  if (p.startsWith('/admin')) return null;
  if (isEnglishPath(p)) return uaReader ? 'to_uk' : null;
  return uaReader ? null : 'to_en';
}

// ── Банер іншої мови без стрибка сторінки ───────────────────────────────────
//
// Мову браузера знає лише браузер, тож до 07.10.2026 LangSuggest вирішував
// показ після гідратації — і банер заввишки 70px з'являвся над шапкою, коли
// людина вже бачила сторінку, зсуваючи все вниз (на слабкому телефоні —
// через 6 с; Lighthouse ловив це як CLS 0,085). Тепер рішення приймає
// inline-скрипт у <body> до першої промальовки й ставить на <html>
// data-lang-suggest; розмітка банера вже в HTML, CSS показує її одразу.
// Правила — ті самі, що в langSuggestion і readsUkrainian вище
// (tests/lang-suggest.test.mjs звіряє скрипт із ними).
export const LANG_SUGGEST_KEY = 'dityam_lang_suggest_dismissed';

export const LANG_SUGGEST_BOOT_SCRIPT = `(function(){try{
var p=location.pathname||'/';
if(p.indexOf('/admin')===0)return;
if(localStorage.getItem('${LANG_SUGGEST_KEY}'))return;
var tags=navigator.languages||[navigator.language||''];
var reads=false;
for(var i=0;i<tags.length;i++){var t=String(tags[i]||'').toLowerCase().trim();
if(t==='uk'||t.indexOf('uk-')===0||t==='ru'||t.indexOf('ru-')===0){reads=true;break;}}
var en=p==='/en'||p.indexOf('/en/')===0;
var s=en?(reads?'to_uk':''):(reads?'':'to_en');
if(s)document.documentElement.setAttribute('data-lang-suggest',s);
}catch(e){}})();`;
