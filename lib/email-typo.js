// Підказка «Можливо, ви мали на увазі …@gmail.com?» під полем email
// (11.10.2026). На формі олімпіади приблизно кожен 9-й з батьків помилився
// в домені — gmai.com, gmali.com, gnmail.com, qmail.com, — і листи поверталися.
//
// Лише ПІДКАЗКА: адресу ніколи не міняємо самі, ні тут, ні на сервері.
// У людини може бути справжній незвичний домен (школа, робота), тож краще
// промовчати, ніж «виправити» правильне. Звідси обережність нижче:
//   - відомий домен або справжній «схожий» (mail.com, ymail.com) — мовчимо;
//   - та сама назва з іншою справжньою зоною (yahoo.ca, live.ca) — мовчимо;
//   - короткі домени (i.ua, me.com, meta.ua, ukr.net) — лише 1 помилка,
//     інакше i.ua, ukr.net і випадкові короткі домени «виправлялися б» одне в одне;
//   - далекий від усіх відомих домен (school.edu.ua) — мовчимо.

export const KNOWN_DOMAINS = Object.freeze([
  'gmail.com', 'ukr.net', 'i.ua', 'icloud.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
  'meta.ua', 'proton.me', 'protonmail.com', 'bigmir.net', 'live.com', 'me.com',
]);

// Часті помилки — напряму, без обчислень. qmail.com — справжній домен QQ, але
// в нашої української аудиторії це майже завжди gmail.com (q поруч із g на телефоні).
export const COMMON_TYPOS = Object.freeze({
  'gmai.com': 'gmail.com', 'gmali.com': 'gmail.com', 'gnmail.com': 'gmail.com', 'qmail.com': 'gmail.com',
  'gmial.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'gmail.cm': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.ru': 'gmail.com', 'gamil.com': 'gmail.com',
  'gmsil.com': 'gmail.com',
  'ukr.ner': 'ukr.net', 'ukr.met': 'ukr.net', 'urk.net': 'ukr.net', 'ukr.nt': 'ukr.net',
  'ukrnet.ua': 'ukr.net', 'ukr.net.ua': 'ukr.net',
});

// Справжні поштові домени, близькі до відомих: їх не чіпаємо ніколи.
const REAL_LOOKALIKES = new Set([
  'mail.com', 'email.com', 'ymail.com', 'gmx.com', 'gmx.net', 'googlemail.com', 'mac.com',
  'pm.me', 'protonmail.ch', 'ua.fm', 'mail.ua', 'email.ua',
]);

const KNOWN = new Set(KNOWN_DOMAINS);
const split = (d) => {
  const i = d.indexOf('.');
  return i < 0 ? [d, ''] : [d.slice(0, i), d.slice(i + 1)];
};

/** Відстань Дамерау — Левенштейна (варіант OSA: заміна, вставка, видалення, сусідня перестановка). */
export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)]);
  for (let j = 0; j <= n; j += 1) d[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

// Скільки помилок дозволяємо для відомого домену: короткі — щільні, там 2
// помилки вже ведуть до чужих справжніх доменів.
const allowed = (known) => (known.length <= 6 || split(known)[0].length <= 4 ? 1 : 2);

/** Виправлений домен (без «@») або null, якщо виправляти нічого. */
function correctDomain(d) {
  if (KNOWN.has(d) || REAL_LOOKALIKES.has(d)) return null;
  if (COMMON_TYPOS[d]) return COMMON_TYPOS[d];

  // Загублена крапка: gmailcom → gmail.com; або зони немає зовсім: gmail → gmail.com.
  if (!d.includes('.')) {
    const hit = KNOWN_DOMAINS.find((k) => k.replace('.', '') === d)
      || (d.length >= 3 ? KNOWN_DOMAINS.find((k) => split(k)[0] === d) : null);
    return hit || null;
  }

  // Та сама назва, інша зона: gmail.cm → gmail.com, але yahoo.ca чи live.ca —
  // справжні адреси, тож лише 1 помилка в зоні й далі не шукаємо.
  const [name, zone] = split(d);
  const same = KNOWN_DOMAINS.find((k) => split(k)[0] === name);
  if (same) return editDistance(zone, split(same)[1]) <= 1 ? same : null;

  let best = null;
  let bestDist = Infinity;
  let tie = false;
  for (const k of KNOWN_DOMAINS) {
    const dist = editDistance(d, k);
    if (dist > allowed(k)) continue;
    if (dist < bestDist) { best = k; bestDist = dist; tie = false; } else if (dist === bestDist) tie = true;
  }
  // Однаково близько до двох відомих — не вгадуємо.
  return best && !tie ? best : null;
}

/**
 * Підказка для адреси: виправлена адреса малими літерами або null.
 * suggestEmail('nina@gmai.com') → 'nina@gmail.com'; suggestEmail('nina@gmail.com') → null.
 */
export function suggestEmail(email) {
  const raw = String(email ?? '').trim().toLowerCase();
  const at = raw.indexOf('@');
  if (at < 1 || at !== raw.lastIndexOf('@')) return null;
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  // Кома замість крапки, подвійна крапка, крапка в кінці — виправляємо для будь-якого домену.
  const clean = domain.replace(/,/g, '.').replace(/\.{2,}/g, '.').replace(/^\.+|\.+$/g, '');
  if (!clean || /\s/.test(clean)) return null;
  const fixed = correctDomain(clean) || clean;
  return fixed === domain ? null : `${local}@${fixed}`;
}
