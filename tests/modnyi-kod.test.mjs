// «Модний код» (Марія, 12.10.2026): безкоштовна студія образу; олімпіада —
// 99 грн, але поки тест не погоджено, оплати немає — лише список очікування.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const L = await import('../lib/modnyi-kod-looks.js');
const { MK } = await import('../lib/modnyi-kod.js');
const read = (f) => readFileSync(f, 'utf8');

test('кожна річ із меню має малюнок', () => {
  for (const k of ['base', 'top', 'bottom', 'outer', 'shoes', 'acc']) {
    for (const v of Object.keys(L.PIECES[k].opts)) {
      if (v === 'none' || v === 'set') continue;
      assert.equal(typeof L.shape[v], 'function', `${k}.${v}`);
      assert.match(L.shape[v]('#c8501a'), /<path|<ellipse|<rect/, `${k}.${v}`);
    }
  }
});

test('усі поєднання малюються, штани лягають поверх взуття', () => {
  const st = JSON.parse(JSON.stringify(L.DEFAULT_LOOK));
  for (const top of Object.keys(L.PIECES.top.opts)) for (const bottom of Object.keys(L.PIECES.bottom.opts)) {
    Object.assign(st, { base: 'set', top, bottom });
    const s = L.lookSvg(st, { live: true });
    assert.ok(s.indexOf('data-part="shoes"') < s.indexOf('data-part="bottom"'));
  }
  for (const base of ['dress1', 'dress2']) assert.match(L.lookSvg({ ...st, base }), /<g filter="url\(#mk-wob\)">/);
});

test('тканини, цілі й візерунки', () => {
  assert.ok(L.FABRICS.find(([k]) => k === 'metal'));
  assert.ok(L.DEFS.includes('id="metal"') && L.DEFS.includes('id="mk-wob"'));
  for (const [k] of L.FABRICS) assert.ok(L.DEFS.includes(`id="${k}"`), k);
  assert.deepEqual(L.usedPatterns(L.DEFAULT_LOOK).sort(), ['ромби', 'шотландка'].sort());
  const t = L.targets({ ...L.DEFAULT_LOOK, base: 'dress1', acc: 'glasses' }).map(([k]) => k);
  assert.deepEqual(t, ['base', 'shoes', 'legs']);
});

test('збережений образ чиститься: лише відомі речі й тканини', () => {
  const c = L.cleanLook({ top: '<script>', shoes: 'loafer', f: { top: 'javascript:x', bottom: 'leo', shoes: '#ffffff' } });
  assert.equal(c.top, L.DEFAULT_LOOK.top);
  assert.equal(c.shoes, 'loafer');
  assert.equal(c.f.top, L.DEFAULT_LOOK.f.top);
  assert.equal(c.f.bottom, 'leo');
  assert.equal(c.f.shoes, '#ffffff');
  assert.deepEqual(L.cleanLook(null), L.DEFAULT_LOOK);
});

test('усе платне: 99 грн за все, студія — лише після оплати (поки — адмін)', () => {
  assert.equal(MK.price, 99);
  assert.equal(MK.open, true);
  const page = read('app/modnyi-kod/page.js');
  assert.doesNotMatch(page.replace(/^\/\/.*$/gm, ''), /безкоштовн/);
  assert.match(page, /modnyi-kod-demo\.mp4/);
  assert.match(page, /JoinForm/);
  assert.match(page, /MkTrack/);
  const studioPage = read('app/modnyi-kod/studiya/page.js');
  assert.match(studioPage, /isAdmin\(/);
  assert.match(studioPage, /index: false/);
  const studio = read('app/modnyi-kod/Studio.js');
  assert.doesNotMatch(studio, /wayforpay|\/api\/.*pay/i);
  assert.match(studio, /if \(!title\.trim\(\)\)/);
  assert.match(read('app/api/modnyi-kod/waitlist/route.js'), /olimp: MK\.slug/);
});

// CLAUDE.md: назва лише «Dityam.com.ua» (на обкладинці — логотип «dityam.com.ua»).
test('бренд і фон', () => {
  for (const f of ['app/modnyi-kod/page.js', 'app/modnyi-kod/studiya/page.js', 'app/modnyi-kod/DeskCollage.js', 'app/modnyi-kod/Studio.js', 'app/modnyi-kod/Waitlist.js', 'lib/modnyi-kod.js', 'lib/modnyi-kod-looks.js']) {
    const t = read(f);
    assert.doesNotMatch(t, /DITYAM/, f);
    assert.doesNotMatch(t, /Dityam(?!\.com\.ua|\+|PlusBot)/, f);
  }
  // Ніколи не бежевий фон (memory: dityam-no-beige-background).
  assert.doesNotMatch(read('app/styles/modnyi-kod.css'), /#f6efe4|#fbf8f2|#fffdf7|#f4efe7|#fff4e8/i);
});

test('сторінка олімпіади як /olimpiada, студія — окремо', () => {
  const page = read('app/modnyi-kod/page.js');
  for (const h of ['Як це виглядає', 'Що отримує кожен учасник', 'Як це працює', 'Які бувають завдання', 'Обкладинка, яку хочеться', 'Взяти участь', 'Питання й відповіді', 'Напишіть нам', 'у соцмережах']) assert.ok(page.includes(h), h);
  assert.match(page, /<DeskCollage \/>/);
    assert.match(read('app/modnyi-kod/studiya/page.js'), /<Studio \/>/);
});

test('обкладинка у стилі Vogue: анонси з образу дитини, гарні назви', async () => {
  const src = read('app/modnyi-kod/VogueCover.js');
  assert.match(src, /dityam\.com\.ua/);
  assert.match(src, /MOTTOS = \[/);
  assert.equal((src.match(/^  '[^']+',$/gm) || []).length >= 5, true);
  assert.doesNotMatch(src, /стьобана/);
  assert.match(read('app/modnyi-kod/page.js'), /<VogueCover /);
  assert.match(read('app/modnyi-kod/Studio.js'), /<VogueCover /);
});

// Марія, 12.10.2026: «не пиши оце стьобана».
test('ніде на сайті немає слова «стьобана»', () => {
  for (const f of ['lib/modnyi-kod-looks.js', 'app/modnyi-kod/page.js', 'app/modnyi-kod/Studio.js', 'app/modnyi-kod/VogueCover.js', 'app/modnyi-kod/DeskCollage.js']) {
    assert.doesNotMatch(read(f), /стьобан/, f);
  }
});

test('«Модний код» — у меню «Наші можливості» й у футері', () => {
  assert.match(read('app/Header.js'), /href: `\/\$\{MK\.slug\}`/);
  assert.match(read('app/Footer.js'), /modnyiKod: '\/modnyi-kod'/);
});

test('положення: правила олімпіади на сторінці, без невирішених обіцянок', () => {
  const page = read('app/modnyi-kod/page.js');
  assert.match(page, /Правила олімпіади/);
  assert.match(page, /ФОП Шутяк Марія Олександрівна/);
  assert.match(page, /не є учнівською олімпіадою МОН/);
  assert.match(page, /відмовитися від публікації/);
  // 30 хвилин (13.10.2026; було 25), спроб скільки завгодно (13.10.2026; було 1).
  assert.doesNotMatch(page, /1 спроба/);
  assert.match(page, /скільки завгодно разів/);
  assert.match(page, /До початку тесту від участі можна відмовитися/);
  assert.equal(MK.minutes, 30);
  assert.match(page, /\{MK\.minutes\} хвилин/);
});

test('олімпіада: відповідей немає в коді, варіанти перемішані, бали рахує сервер', async () => {
  const { BANK } = await import('../content/modnyi-kod/bank.js');
  const M = await import('../lib/modnyi-kod.js');
  assert.equal(BANK.length, 25);
  for (const q of BANK) { assert.equal(q.ok, undefined, q.id); assert.equal(q.options.length, 4, q.id); }
  const o1 = M.mkOrder(BANK, 'a'.repeat(32)); const o2 = M.mkOrder(BANK, 'b'.repeat(32));
  assert.deepEqual(o1.map((o) => o.id), BANK.map((q) => q.id)); // порядок тем — як у банку
  assert.notDeepEqual(o1.map((o) => o.options.join('')), o2.map((o) => o.options.join('')));
  const keys = Object.fromEntries(BANK.map((q) => [q.id, 0]));
  const answers = Object.fromEntries(BANK.slice(0, 10).map((q) => [q.id, 0]));
  const r = M.mkScore(BANK, o1, answers, keys);
  assert.equal(r.score, 10); assert.equal(r.max, 25); assert.equal(r.missed.length, 15);
  assert.equal(M.isMkOrder(`mk-${'a'.repeat(32)}-1`), true);
  assert.equal(M.tokenFromMkRef(`mk-${'a'.repeat(32)}-1791`), 'a'.repeat(32));
  assert.equal(M.cleanMkEntry({ name: 'Соломія Коваль', age: 9, email: 'a@b.cc', consent: true }).error, 'age');
  assert.equal(M.cleanMkEntry({ name: 'Соломія Коваль', age: 11, email: 'A@B.cc', consent: true }).entry.child_name, 'Соломія');
  // Колбек: mk-… обробляється ДО статусів Dityam+; журнал оплат знає mk_entry.
  const cb = read('app/api/pay/wayforpay/route.js');
  assert.ok(cb.indexOf('isMkOrder(b.orderReference)') < cb.indexOf("from('digest_subscribers')"));
  const { productOf } = await import('../lib/payments.js');
  assert.equal(productOf(`mk-${'a'.repeat(32)}-1`, 99), 'mk_entry');
  // Облік: сторінка, форма, оплата, тест, обкладинка.
  const server = read('lib/modnyi-kod-server.js');
  for (const e of ["'mk_paid'", 'notifyAdmin(']) assert.ok(server.includes(e), e);
  for (const f of ['app/api/modnyi-kod/start/route.js', 'app/api/modnyi-kod/submit/route.js', 'app/api/modnyi-kod/look/route.js']) assert.match(read(f), /serverEvent\(/, f);
});

test('Dityam+: олімпіади в меню бота, реєстрація без оплати, тренування без ліміту', async () => {
  const bot = read('app/api/telegram/plus/route.js');
  assert.match(bot, /callback_data: 'menu:olymp'/);
  assert.match(bot, /handleMkCallback\(bot, cbq\)/);
  assert.match(bot, /handleMkReply\(bot, msg\)/);
  const M = await import('../lib/modnyi-kod.js');
  assert.equal(M.ageFromPrompt(`${M.MK_NAME_PROMPT} (12 років)`), 12);
  assert.equal(M.ageFromPrompt('інше'), null);
  assert.equal(M.cleanChildName('  Соломія Коваль '), 'Соломія');
  const srv = read('lib/modnyi-kod-server.js');
  assert.match(srv, /source: 'dityam_plus'/);
  const pr = read('app/api/modnyi-kod/practice/route.js');
  assert.match(pr, /plusActive\(/);
  // Тренування не чіпає офіційних балів: оновлюємо лише лічильник.
  assert.match(pr, /updateEntry\(db, b\.t, \{ practice_count:/);
  assert.doesNotMatch(pr, /updateEntry\([^)]*\bscore\b/);
});

test('кабінет: обкладинка замість сертифіката, «Поділитися» й Dityam+ за 1 грн (13.10.2026)', () => {
  const cab = readFileSync('app/modnyi-kod/kabinet/page.js', 'utf8');
  assert.doesNotMatch(cab, /mkK-cert/);
  assert.match(cab, /<ShareCover /);
  assert.match(cab, /start=from_modnyi_kod/);
  const share = readFileSync('app/modnyi-kod/kabinet/ShareCover.js', 'utf8');
  // Ділимося сторінкою олімпіади, а не приватним кабінетом.
  assert.doesNotMatch(share, /kabinet/);
  for (const k of ['t.me/share', 'viber://', 'wa.me', 'facebook.com/sharer']) assert.ok(share.includes(k), k);
  assert.match(readFileSync('lib/wayforpay.js', 'utf8'), /'modnyi_kod'/);
  const cover = readFileSync('app/api/modnyi-kod/cover/route.js', 'utf8');
  assert.match(cover, /validMkToken\(t\)/);
  assert.doesNotMatch(cover, /DEVDEMO|NODE_ENV/);
});

test('адмін проходить «Модний код» без оплати, і це не рахується продажем (13.10.2026)', () => {
  const start = readFileSync('app/api/modnyi-kod/start/route.js', 'utf8');
  assert.match(start, /isAdmin\(cookies\(\)\.get\('dityam_admin'\)/);
  assert.ok(start.indexOf('adminTestPaid') < start.indexOf('startPayment(db, row)'), 'адмін не має йти в WayForPay');
  const srv = readFileSync('lib/modnyi-kod-server.js', 'utf8');
  const fn = srv.slice(srv.indexOf('export async function adminTestPaid'), srv.indexOf('export async function handleMkCallback'));
  assert.match(fn, /amount: 0/);
  assert.match(fn, /source: 'admin_test'/);
  assert.doesNotMatch(fn, /recordPayment|serverEvent|notifyAdmin/);
});

test('тест можна перепроходити скільки завгодно, на обкладинці — кращий результат (13.10.2026)', () => {
  const retake = readFileSync('app/api/modnyi-kod/retake/route.js', 'utf8');
  assert.doesNotMatch(retake, /attempts\s*>=|MAX_ATTEMPTS/, 'ліміту спроб немає');
  assert.match(retake, /best_score/);
  const submit = readFileSync('app/api/modnyi-kod/submit/route.js', 'utf8');
  assert.match(submit, /keepBest/);
  const begin = readFileSync('app/api/modnyi-kod/begin/route.js', 'utf8');
  assert.match(begin, /\$\{t\}#\$\{row\.attempts\}/, 'нова спроба — новий порядок');
  assert.match(readFileSync('app/modnyi-kod/kabinet/page.js', 'utf8'), /<RetakeButton /);
  assert.match(readFileSync('app/modnyi-kod/page.js', 'utf8'), /Чи можна пройти тест ще раз\?/);
});

test('бот: у тексті повідомлень олімпіад немає емодзі, які Telegram показує кодом (13.10.2026)', () => {
  for (const f of ['lib/modnyi-kod-bot.js']) {
    const lines = readFileSync(f, 'utf8').split('\n').filter((l) => !l.includes('text:') && !l.trim().startsWith('//'));
    for (const l of lines) assert.doesNotMatch(l, /[\u{1F300}-\u{1F3FF}]/u, `${f}: ${l.trim()}`);
  }
  assert.doesNotMatch(readFileSync('lib/modnyi-kod-bot.js', 'utf8'), /безкоштовно\)/);
});

test('SEO «Модного коду»: картинка для соцмереж, дата старту, «хлібні крихти», назва сайту (13.10.2026)', () => {
  const page = readFileSync('app/modnyi-kod/page.js', 'utf8');
  assert.match(page, /title: \{ absolute: `\$\{TITLE\} — Dityam\.com\.ua` \}/);
  assert.match(page, /startDate: START_DATE/);
  assert.match(page, /'@type': 'BreadcrumbList'/);
  assert.doesNotMatch(page, /без нудних тестів/);
  assert.match(readFileSync('app/modnyi-kod/opengraph-image.js', 'utf8'), /ImageResponse/);
  assert.match(readFileSync('app/modnyi-kod/twitter-image.js', 'utf8'), /opengraph-image/);
});

test('анімація «Модного коду»: фігури й манекен не рухаються (13.10.2026)', () => {
  const css = readFileSync('app/styles/modnyi-kod.css', 'utf8');
  const motion = css.slice(css.indexOf('Трішки руху на картинках'));
  for (const sel of ['.dk-fig', '.dk-form', '.vc-fig', '.mkT-q-pic {']) {
    const line = motion.split('\n').find((l) => l.includes(sel) && l.includes('animation'));
    assert.equal(line, undefined, `${sel} знову рухається: ${line}`);
  }
});
