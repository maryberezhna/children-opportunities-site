// Челендж «Твій образ на обкладинці» і архів обкладинок (Марія, 11.10.2026:
// «онлайн-галерею на сайті і повісити малюнки дітей, звичайно без детальних
// даних»; з трьох макетів обрано «Обкладинку»). Дитина малює свій образ —
// одяг, у якому їй було б найкраще, — батьки фотографують малюнок і
// надсилають, і він стає обкладинкою модного журналу dityam.com.ua. Без
// переможців: обкладинку, місце в архіві й сертифікат отримує кожен, а замість
// місць — відзнаки, яких може бути багато. Оргвнесок 99 грн.
//
// Чому малюнок, а не фото образу: світові дитячі фешн-конкурси (Young Talent
// of Tomorrow, Graduate Fashion Foundation) теж починають з ескізу — і так на
// сайті ніколи не буває фото самої дитини.
//
// Рішення Марії (11.10.2026): вік 6–17; під малюнком справжнє імʼя без
// прізвища і вік; старт — щойно буде готово. Ні прізвища, ні міста, ні школи,
// ні email на сайті немає; лайків і коментарів теж — щоб не виник рейтинг.
//
// Чиста логіка без сервера — її перевіряє tests/obraz.test.mjs.

export const OBRAZ = {
  slug: 'obraz',
  // 11.10.2026: Марія обрала формат «Обкладинка» — малюнок стає обкладинкою
  // модного журналу dityam.com.ua; участь платна (оргвнесок), бо «в нас
  // немає грошей». Якщо фото не підійшло — батьки надсилають інше без доплати.
  title: 'Твій образ на обкладинці',
  season: 'Осінь 2026',
  price: 99,
  ageFrom: 6,
  ageTo: 17,
  // Поточна тема. Нова тема — новий key: галерея показує роботи за темами.
  theme: {
    key: 'osin-2026',
    title: 'Мій образ для осені',
    task: 'Намалюй одяг, у якому тобі було б найзатишніше й найкрасивіше цієї осені: на прогулянку, до школи, на свято чи під дощ — як захочеш.',
    // Останній день прийому робіт, включно (за Києвом).
    until: '2026-10-26',
  },
  maxPerEmailDay: 3,
  // Розмір файлу після стиснення в браузері (≈1600 px JPEG — це 0,3–1 МБ).
  maxBytes: 3 * 1024 * 1024,
  maxSide: 1600,
  titleMax: 60,
  storyMax: 300,
  bucket: 'obraz',
};

// Відзнаки замість місць: обирає Марія, коли публікує малюнок. Порожньо —
// теж нормально: у галереї висить кожен малюнок, відзнака — лише бонус.
export const AWARDS = [
  'Найсміливіше поєднання',
  'Найкраща історія',
  'Найнесподіваніша ідея',
  'Найзатишніший образ',
  'Найяскравіші кольори',
  'Найуважніше до деталей',
];

export const AGE_GROUPS = [
  { key: '6-9', label: '6–9 років', from: 6, to: 9 },
  { key: '10-13', label: '10–13 років', from: 10, to: 13 },
  { key: '14-17', label: '14–17 років', from: 14, to: 17 },
];

export const ageGroup = (key) => AGE_GROUPS.find((g) => g.key === key) || null;

/** «9 років», «1 рік», «3 роки» — українські форми після числа. */
export function yearsWord(n) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return 'років';
  if (b === 1) return 'рік';
  if (b >= 2 && b <= 4) return 'роки';
  return 'років';
}

/** Прийом робіт на тему ще триває? `today` — 'YYYY-MM-DD' за Києвом. */
export const themeOpen = (today, theme = OBRAZ.theme) => String(today) <= theme.until;

const oneLine = (s, max) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Лише імʼя: на сайті під малюнком ніколи не буде прізвища. Беремо перше
 * слово — навіть якщо батьки вписали «Соломія Коваленко».
 */
export function firstNameOnly(raw) {
  const first = oneLine(raw, 60).split(' ')[0] || '';
  return first.replace(/[^\p{L}'ʼ’-]/gu, '').slice(0, 30);
}

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

/**
 * Поля заявки → { entry } або { error: 'назва поля' }, щоб форма показала,
 * що виправити. Файл перевіряє окремо checkJpeg.
 */
export function cleanEntry(b) {
  const name = firstNameOnly(b?.name);
  if (name.length < 2) return { error: 'name' };
  const age = Number(b?.age);
  if (!Number.isInteger(age) || age < OBRAZ.ageFrom || age > OBRAZ.ageTo) return { error: 'age' };
  const title = oneLine(b?.title, OBRAZ.titleMax);
  if (title.length < 2) return { error: 'title' };
  const story = String(b?.story || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, OBRAZ.storyMax);
  const email = String(b?.email || '').trim().toLowerCase();
  if (!isEmail(email)) return { error: 'email' };
  if (b?.consent !== true) return { error: 'consent' };
  const designer = ['дизайнер', 'дизайнерка'].includes(b?.designer) ? b.designer : null;
  return {
    entry: {
      child_name: name, age, title, story: story || null, parent_email: email,
      consent_instagram: b?.instagram === true, designer_word: designer,
    },
  };
}

// ── Файл ────────────────────────────────────────────────────────────────────
// Браузер перемальовує фото на полотні й віддає JPEG — це вже прибирає EXIF
// (а в ньому GPS-координати: батьки фотографують малюнок удома). Сервер не
// довіряє браузеру й вирізає з JPEG усі службові блоки APP1–APP15 (EXIF, XMP,
// IPTC, Photoshop) і коментарі ще раз.

/** Чи це справжній JPEG і чи вміщається в ліміт. */
export function checkJpeg(buf) {
  if (!buf || buf.length < 4) return { error: 'file' };
  if (buf.length > OBRAZ.maxBytes) return { error: 'file_big' };
  if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return { error: 'file' };
  return { ok: true };
}

/**
 * JPEG без метаданих: лишає APP0 (JFIF) і все, що потрібно для картинки,
 * викидає APP1–APP15 і COM. Пошкоджений файл — null.
 */
export function stripJpegMetadata(input) {
  const buf = Buffer.from(input);
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  const parts = [buf.subarray(0, 2)];
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    // Заповнювачі 0xFF між блоками.
    if (marker === 0xff) { i += 1; continue; }
    // Початок даних картинки: далі метаданих не буває — копіюємо до кінця.
    if (marker === 0xda) { parts.push(buf.subarray(i)); return Buffer.concat(parts); }
    // Маркери без довжини.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(buf.subarray(i, i + 2)); i += 2; continue;
    }
    if (marker === 0xd9) { parts.push(buf.subarray(i, i + 2)); return Buffer.concat(parts); }
    if (i + 4 > buf.length) return null;
    const len = buf.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > buf.length) return null;
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) parts.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

// ── Адреси ──────────────────────────────────────────────────────────────────

const PUBLIC_ID_RE = /^[0-9a-f]{10}$/;
const TOKEN_RE = /^[0-9a-f]{32}$/;
export const validPublicId = (s) => PUBLIC_ID_RE.test(String(s || ''));
export const validToken = (s) => TOKEN_RE.test(String(s || ''));

export const workPath = (publicId) => `/${OBRAZ.slug}/r/${publicId}`;
export const certificatePath = (token) => `/${OBRAZ.slug}/sertyfikat?t=${token}`;
export const removePath = (token) => `/${OBRAZ.slug}/prybraty?t=${token}`;
/** Сторінка заявки: превʼю обкладинки, оплата, стан перевірки, нове фото. */
export const entryPath = (token) => `/${OBRAZ.slug}/zayavka?t=${token}`;
export const coverPrintPath = (token) => `/${OBRAZ.slug}/obkladynka?t=${token}`;

/** Номер замовлення WayForPay: obraz-<токен>-<час>. */
export const isObrazOrder = (ref) => String(ref || '').startsWith('obraz-');
export const tokenFromObrazRef = (ref) => (String(ref || '').match(/^obraz-([0-9a-f]{32})-\d+$/) || [])[1] || null;
export const obrazProductName = () => `Організаційний внесок: онлайн-челендж «${OBRAZ.title}» (Dityam.com.ua)`;

/** Публічна адреса файлу в Supabase Storage (бакет публічний, шлях випадковий). */
export function imageUrl(path, base = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  if (!path || !base) return null;
  return `${String(base).replace(/\/+$/, '')}/storage/v1/object/public/${OBRAZ.bucket}/${path}`;
}

/** «Соломія, 9 років» — підпис під малюнком. */
export const caption = (w) => `${w.child_name}, ${w.age} ${yearsWord(w.age)}`;

// ── Листи батькам ───────────────────────────────────────────────────────────

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SIGN_TEXT = (from) => ['Марія Шутяк, Dityam.com.ua', from];
const SIGN_HTML = (from) => `<p>Марія Шутяк, Dityam.com.ua<br><a href="mailto:${esc(from)}">${esc(from)}</a></p>`;
const BTN = 'display:inline-block;padding:14px 28px;border-radius:999px;background:#c8501a;color:#fff;font-weight:bold;text-decoration:none';
const WRAP = 'font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#1c1c1c;max-width:560px';

/** Лист «малюнок уже в галереї» — коли Марія натиснула «Опублікувати». */
export function buildPublishedMail(w, { site, from }) {
  const work = `${site}${workPath(w.public_id)}`;
  const cert = `${site}${certificatePath(w.token)}`;
  const cover = `${site}${coverPrintPath(w.token)}`;
  const remove = `${site}${removePath(w.token)}`;
  const subject = `Обкладинка «${w.title}» готова — ${w.child_name} у галереї Dityam.com.ua`;
  const award = w.award ? `Ще й з відзнакою «${w.award}»!` : '';
  const text = [
    'Добрий день!',
    '',
    `Малюнок ${w.child_name} «${w.title}» став обкладинкою модного журналу dityam.com.ua і вже в галереї челенджу «${OBRAZ.title}». ${award}`.trim(),
    `Подивитися й поділитися: ${work}`,
    `Обкладинка для друку (А4): ${cover}`,
    `Сертифікат: ${cert}`,
    '',
    'На сайті під малюнком — лише імʼя та вік, без прізвища й інших даних.',
    `Якщо захочете прибрати малюнок з галереї: ${remove}`,
    '',
    ...SIGN_TEXT(from),
  ].join('\n');
  const html = `<div style="${WRAP}">
<p>Добрий день!</p>
<p>Малюнок <b>${esc(w.child_name)}</b> «${esc(w.title)}» став обкладинкою модного журналу dityam.com.ua і вже в галереї челенджу «${esc(OBRAZ.title)}».${award ? ` <b>${esc(award)}</b>` : ''}</p>
<p><a href="${esc(work)}" style="${BTN}">Подивитися обкладинку</a></p>
<p><a href="${esc(cover)}">Обкладинка для друку (А4)</a> · <a href="${esc(cert)}">Сертифікат</a> — їх можна роздрукувати чи зберегти.</p>
<p style="color:#555;font-size:14px">На сайті під малюнком — лише імʼя та вік, без прізвища й інших даних. Якщо захочете прибрати малюнок з галереї, <a href="${esc(remove)}" style="color:#555">натисніть тут</a>.</p>
${SIGN_HTML(from)}
</div>`;
  return { subject, text, html };
}

/** Лист після оплати: оргвнесок отримали, малюнок на перевірці. */
export function buildPaidMail(w, { site, from }) {
  const link = `${site}${entryPath(w.token)}`;
  const subject = `Оплату отримали — обкладинка «${w.title}» уже в роботі`;
  const text = [
    'Добрий день!',
    '',
    `Дякуємо! Оргвнесок ${OBRAZ.price} грн отримали — ${w.child_name} бере участь у челенджі «${OBRAZ.title}».`,
    'Ми переглянемо малюнок протягом 1–2 днів. Щойно обкладинка зʼявиться в галереї, надішлемо лист із посиланням, обкладинкою для друку й сертифікатом.',
    `Стан заявки: ${link}`,
    '',
    ...SIGN_TEXT(from),
  ].join('\n');
  const html = `<div style="${WRAP}">
<p>Добрий день!</p>
<p>Дякуємо! Оргвнесок ${OBRAZ.price} грн отримали — <b>${esc(w.child_name)}</b> бере участь у челенджі «${esc(OBRAZ.title)}».</p>
<p>Ми переглянемо малюнок протягом 1–2 днів. Щойно обкладинка зʼявиться в галереї, надішлемо лист із посиланням, обкладинкою для друку й сертифікатом.</p>
<p><a href="${esc(link)}" style="${BTN}">Стан заявки</a></p>
${SIGN_HTML(from)}
</div>`;
  return { subject, text, html };
}

/** Фото не підійшло (людина, документ, не малюнок): просимо інше — без доплати. */
export function buildReuploadMail(w, { site, from }) {
  const again = `${site}${entryPath(w.token)}`;
  const subject = `Малюнок «${w.title}»: надішліть, будь ласка, інше фото`;
  const text = [
    'Добрий день!',
    '',
    `Дякуємо, що ${w.child_name} бере участь у челенджі «${OBRAZ.title}»! Цей знімок ми, на жаль, не можемо поставити на обкладинку.`,
    'Найчастіше причина в тому, що на фото, крім малюнка, видно людину, документ чи інші особисті дані, — або на знімку не малюнок.',
    `Сфотографуйте, будь ласка, лише сам малюнок і надішліть ще раз — оплачувати вдруге не потрібно: ${again}`,
    '',
    ...SIGN_TEXT(from),
  ].join('\n');
  const html = `<div style="${WRAP}">
<p>Добрий день!</p>
<p>Дякуємо, що <b>${esc(w.child_name)}</b> бере участь у челенджі «${esc(OBRAZ.title)}»! Цей знімок ми, на жаль, не можемо поставити на обкладинку.</p>
<p>Найчастіше причина в тому, що на фото, крім малюнка, видно людину, документ чи інші особисті дані, — або на знімку не малюнок.</p>
<p>Сфотографуйте, будь ласка, лише сам малюнок і надішліть ще раз — <b>оплачувати вдруге не потрібно</b>.</p>
<p><a href="${esc(again)}" style="${BTN}">Надіслати інше фото</a></p>
${SIGN_HTML(from)}
</div>`;
  return { subject, text, html };
}
