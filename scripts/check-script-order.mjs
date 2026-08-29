// Вартовий проти помилки, яка на два дні зупинила щоденний пост у канал.
//
// Що сталось. У check-deadlines.mjs верхньорівневий `await sendDailyDigest()`
// стоїть у середині файлу, а константи EVENT_TYPES та isEvent були оголошені
// нижче. Оголошення функцій підіймаються, тож whenLine() викликалась успішно —
// але всередині зверталась до `const isEvent`, який на той момент ще був у
// часовій мертвій зоні. Результат: ReferenceError у проді, нічний воркфлоу
// падав, канал мовчав, і жоден тест цього не ловив.
//
// Правило просте й перевіряється статично: у цьому скрипті жодна
// верхньорівнева константа не сміє бути оголошена ПІСЛЯ рядка, який запускає
// дайджест. Усе, до чого дайджест може дотягнутись, має бути вже ініціалізоване.
import { readFileSync } from 'node:fs';

const FILE = 'scripts/check-deadlines.mjs';
const LAUNCH = 'await sendDailyDigest()';

const src = readFileSync(FILE, 'utf8');
const lineOf = (i) => src.slice(0, i).split('\n').length;

const launchAt = src.indexOf(LAUNCH);
if (launchAt < 0) {
  console.error(`✗ ${FILE}: не знайдено «${LAUNCH}» — вартовий втратив орієнтир, перевір його.`);
  process.exit(1);
}

const late = [];
for (const m of src.matchAll(/^const (\w+)/gm)) {
  if (m.index > launchAt) late.push({ name: m[1], line: lineOf(m.index) });
}

if (late.length) {
  console.error(`✗ ${FILE}: константи оголошені після запуску дайджесту (рядок ${lineOf(launchAt)}):`);
  for (const c of late) console.error(`    ${c.name} — рядок ${c.line}`);
  console.error('  Перенеси їх вище: інакше все, що дайджест викличе, впаде в ReferenceError.');
  process.exit(1);
}

console.log(`✓ ${FILE}: константи оголошені до запуску дайджесту (рядок ${lineOf(launchAt)})`);
