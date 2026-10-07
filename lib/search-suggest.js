// Підказки під полем пошуку (Марія 03.10.2026: «чи можеш ти викидати
// запропоновані слова в процесі»). Два види:
//   слова — дописуємо останнє слово запиту тим, що справді є в записах
//           («англ» → «англійська»), і лише якщо дописаний запит щось знайде;
//   записи — до чотирьох можливостей, у назві яких є всі слова запиту.
//
// Словник будується з того самого набору, що й список (OpportunitiesList),
// тож підказка ніколи не веде в порожнечу. Функції тут чисті — їх ганяють
// тести; спільне сховище внизу лише передає набір від списку до хіро.
import { normalize, stem, stemVariants, queryTokens, buildHaystack, matchesQuery } from './search.js';

// Службові й надто загальні слова: «для», «дітей», «років» є в половині
// назв, і підказка «дітей» на «ді» нічого не звужує.
const SKIP = new Set([
  'для', 'від', 'без', 'про', 'під', 'при', 'або', 'the', 'and', 'for', 'with',
  'дітей', 'діти', 'дитини', 'дітям', 'років', 'роки', 'рік', 'підлітків', 'підлітки',
  'школярів', 'учнів', 'україни', 'україні', 'українських',
]);

const WORD_RE = /[a-zа-яіїєґ'ʼ’]+/gi;

// Яку форму слова показувати. У назвах слова здебільшого в родовому
// («курси англійської мови»), і найчастіша форма дала б підказку
// «англійська мови». Тому спершу форма, схожа на називний відмінок.
const GENITIVE_LIKE = /(ої|ої|ів|їв|ам|ям|ами|ями|ах|ях|ою|ею|ові|еві|ого|ому|их|им|ими|и|і|у|ю)$/;
const formRank = (w) => (GENITIVE_LIKE.test(w) ? 1 : 0);

/**
 * Словник зі статей: основа → найчастіша форма слова й кількість записів.
 * Слово з назви важить утричі більше за слово з опису — назва точніша.
 * Рідкісне (менше двох записів) не пропонуємо: це здебільшого власні назви.
 */
export function buildVocabulary(items) {
  const groups = new Map();
  for (const it of items || []) {
    const seen = new Set();
    const add = (text, weight) => {
      for (const raw of String(text || '').match(WORD_RE) || []) {
        const w = normalize(raw).replace(/^'+|'+$/g, '');
        if (w.length < 3 || SKIP.has(w)) continue;
        const key = stem(w);
        let g = groups.get(key);
        if (!g) { g = { forms: new Map(), docs: 0, score: 0, caps: 0 }; groups.set(key, g); }
        g.forms.set(w, (g.forms.get(w) || 0) + weight);
        g.score += weight;
        // Абревіатури (МОН, ЗНО, AFS) показуємо великими, як у записах.
        if (raw.length <= 6 && raw === raw.toUpperCase()) g.caps += weight;
        if (!seen.has(key)) { seen.add(key); g.docs += 1; }
      }
    };
    add(it.title, 3);
    add(it.summary, 1);
  }
  const vocab = [];
  for (const [key, g] of groups) {
    if (g.docs < 2) continue;
    const word = [...g.forms]
      .sort((a, b) => formRank(a[0]) - formRank(b[0]) || b[1] - a[1] || a[0].length - b[0].length)[0][0];
    const label = g.caps * 2 > g.score ? word.toUpperCase() : word;
    vocab.push({ word, label, stem: key, docs: g.docs, score: g.score });
  }
  return vocab.sort((a, b) => b.score - a.score);
}

/** Індекс назв: для підказок-записів і щоб у видачі назва важила більше. */
export const titleHaystack = (item) => buildHaystack([item.title, item.title_en]);

/**
 * Підказки для запиту `q`.
 * `index` — Map id → haystack усього запису (той самий, що фільтрує список),
 * `titles` — Map id → haystack назви.
 */
export function suggest(q, { vocab = [], items = [], index, titles }, { words = 5, records = 4 } = {}) {
  const text = normalize(q);
  const tokens = queryTokens(q);
  const out = { words: [], records: [] };
  if (!tokens.length) return out;

  // Слова: дописуємо лише останнє слово, і лише поки людина його друкує
  // (після пробілу вже нема чого дописувати). Першому слову треба дві
  // літери, наступним досить однієї: «англійська м» → «англійська мова».
  const lastRaw = (text.match(/[a-zа-яіїєґ0-9']+$/i) || [''])[0];
  const head = q.slice(0, q.length - lastRaw.length);
  const minLen = queryTokens(head).length ? 1 : 2;
  if (lastRaw.length >= minLen && index) {
    const lastStems = [...stemVariants(stem(lastRaw))];
    const candidates = [];
    for (const v of vocab) {
      if (v.word === lastRaw) continue;
      const hit = v.word.startsWith(lastRaw)
        || (lastRaw.length >= 4 && lastStems.some((s) => v.stem.startsWith(s)));
      if (hit) candidates.push(v);
      if (candidates.length >= 15) break;
    }
    const seen = new Set();
    const counted = [];
    for (const v of candidates) {
      const full = `${head}${v.label}`;
      const key = normalize(full).trim();
      if (seen.has(key)) continue;
      seen.add(key);
      const tk = queryTokens(full);
      let n = 0;
      for (const it of items) {
        const hay = index.get(it.id);
        if (hay && matchesQuery(tk, hay)) n += 1;
      }
      if (n > 0) counted.push({ text: full, word: v.label, head, n });
    }
    // Найбільше знахідок — вище: це й найімовірніше продовження.
    out.words = counted.sort((a, b) => b.n - a.n).slice(0, words);
  }

  if (titles) {
    for (const it of items) {
      const hay = titles.get(it.id);
      if (hay && matchesQuery(tokens, hay)) out.records.push(it);
      if (out.records.length >= records) break;
    }
  }
  return out;
}

// ── Спільне сховище ─────────────────────────────────────────────────────────
// Поле в хіро головної (HomeHero) і список (OpportunitiesList) — сусіди, а
// записи має лише список. Він кладе сюди готовий набір, хіро читає звідси.
// Передавати записи хіро ще й пропом означало б удруге везти їх у HTML.
let source = null;
const listeners = new Set();

export function setSuggestSource(next) {
  source = next;
  listeners.forEach((fn) => fn());
}

export function subscribeSuggestSource(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getSuggestSource = () => source;
export const getServerSuggestSource = () => null;

// Індекси пошуку рахуються не одразу, а коли людина вперше стала в поле
// пошуку — будь-яке з трьох (хіро, бічна панель, телефон). 07.10.2026 («чи не
// перевантажені сторінки»): словник підказок і пошуковий індекс на ~730
// записів забирали ~25 мс на ноутбуці й у кілька разів більше на телефоні —
// на кожному відкритті головної, хоча шукає лише частина людей. Поле кличе
// wantSuggestSource(), список слухає й будує індекси.
let wanted = false;
const wantListeners = new Set();

export function wantSuggestSource() {
  if (wanted) return;
  wanted = true;
  wantListeners.forEach((fn) => fn());
}

export function onSuggestSourceWanted(fn) {
  if (wanted) {
    fn();
    return () => {};
  }
  wantListeners.add(fn);
  return () => wantListeners.delete(fn);
}
