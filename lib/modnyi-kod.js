// «Модний код» — онлайн-олімпіада з моди Dityam.com.ua (рішення Марії 12.10.2026).
//
// З 12.10.2026 усе платне (Марія: «просто все робимо платною… все включено
// в цю вартість»): оргвнесок 99 грн = студія образу + тест на 25 завдань
// із розбором, справжня обкладинка з балами для друку А4, сертифікат, публікація
// на сайті й у соцмережах (Марія, 12.10.2026). Поки тест не готовий (завдання ще на погодженні), кнопка
// олімпіади збирає email у список очікування — нічого не продаємо наперед.

export const MK = {
  slug: 'modnyi-kod',
  title: 'Модний код',
  ageFrom: 10,
  ageTo: 14,
  price: 99,
  // Час на тест — 25 хвилин (Марія, 12.10.2026).
  minutes: 25,
  // Тест і оплата відкриються після погодження 25 завдань.
  open: true,
  season: 'Осінь 2026',
  titleMax: 40,
};

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

// ── Олімпіада: чиста логіка (12.10.2026, запуск) ─────────────────────────────
export const MK_GRACE_SECONDS = 20;

/** Заявка з форми → { entry } або { error: 'поле' }. */
export function cleanMkEntry(b) {
  const name = String(b?.name || '').replace(/\s+/g, ' ').trim().split(' ')[0].replace(/[^\p{L}'ʼ’-]/gu, '').slice(0, 30);
  if (name.length < 2) return { error: 'name' };
  const age = Number(b?.age);
  if (!Number.isInteger(age) || age < MK.ageFrom || age > MK.ageTo) return { error: 'age' };
  const email = String(b?.email || '').trim().toLowerCase();
  if (!isEmail(email)) return { error: 'email' };
  if (b?.consent !== true) return { error: 'consent' };
  const designer = ['дизайнер', 'дизайнерка'].includes(b?.designer) ? b.designer : null;
  return { entry: { child_name: name, child_age: age, parent_email: email, designer_word: designer } };
}

function seedFrom(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Порядок для дитини: завдання — у порядку банку (там теми вже розставлені
 * так, щоб схожі не стояли поруч — Марія), а варіанти перемішані по-своєму
 * для кожної дитини, щоб відповіді не переписували «1 — А, 2 — Б».
 */
export function mkOrder(bank, token) {
  const rand = mulberry32(seedFrom(token));
  return bank.map((q) => {
    const idx = q.options.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return { id: q.id, options: idx };
  });
}

/** Що бачить браузер: без правильних відповідей. */
export function mkPublicQuestions(bank, order) {
  const byId = new Map(bank.map((q) => [q.id, q]));
  return (order || []).map((o) => {
    const q = byId.get(o.id);
    return q ? { id: q.id, topic: q.topic, q: q.q, art: q.art, options: o.options.map((i) => ({ id: i, text: q.options[i] })) } : null;
  }).filter(Boolean);
}

export function mkScore(bank, order, answers, keys) {
  let score = 0;
  const missed = [];
  (order || []).forEach((o, i) => {
    const given = answers ? answers[o.id] : undefined;
    const right = keys ? keys[o.id] : undefined;
    if (given !== undefined && given !== null && Number.isInteger(right) && Number(given) === right) score += 1;
    else missed.push({ num: i + 1, id: o.id });
  });
  return { score, max: (order || []).length, missed };
}

export const mkDeadline = (startedAt) => new Date(new Date(startedAt).getTime() + MK.minutes * 60 * 1000);
export const mkAcceptUntil = (startedAt) => new Date(mkDeadline(startedAt).getTime() + MK_GRACE_SECONDS * 1000);
export const isMkOrder = (ref) => String(ref || '').startsWith('mk-');
export const tokenFromMkRef = (ref) => (String(ref || '').match(/^mk-([0-9a-f]{32})-\d+$/) || [])[1] || null;
export const validMkToken = (t) => /^[0-9a-f]{32}$/.test(String(t || ''));
export const mkCabinet = (token) => `/${MK.slug}/kabinet?t=${token}`;
