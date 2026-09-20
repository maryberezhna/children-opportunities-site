/**
 * Перевірка актуальності перед публікацією в Telegram.
 *
 * Навіщо. 20.09.2026 у канал пішла «Літня ІТ-школа Star for Life Ukraine»:
 * назву взяли зі сторінки 12 липня, коли там справді була літня школа. Школа
 * скінчилась 20 серпня, сторінка джерела стала бібліотекою курсів, але запис
 * лишався активним — щоденна перевірка лінка бачила код 200 і нічого більше,
 * а глибока планова перевірка стояла в черзі аж на 22 вересня.
 *
 * Тепер жодна можливість не йде в канал без свіжого погляду на саму сторінку.
 * Логіка перевірки не дублюється: це той самий scraper/lifecycle.py, якому
 * додано режим `--ids` — перевірити рівно ці записи поза розкладом. Він же
 * одразу лагодить базу: закриває те, що завершилось, і переносить дати.
 *
 * Вартість: кілька сторінок і стільки ж звернень до моделі на день.
 *
 * PUBLISH_CHECK=off вимикає перевірку — лише для сухих прогонів і preview,
 * де ми нічого не надсилаємо.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRAPER_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'scraper');
const PYTHON = process.env.PYTHON_BIN || 'python3';
const TIMEOUT_MS = Number(process.env.PUBLISH_CHECK_TIMEOUT_MS || 180_000);

export const checkDisabled = () => String(process.env.PUBLISH_CHECK || '').toLowerCase() === 'off';

function runLifecycle(ids, jsonOut) {
  return new Promise((resolve, reject) => {
    const child = spawn(PYTHON, [
      'lifecycle.py', '--ids', ids.join(','), '--json-out', jsonOut,
    ], {
      cwd: SCRAPER_DIR,
      env: {
        ...process.env,
        // Скрапери читають свої імена змінних, у Node-воркфлоу вони інші.
        SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY
          || process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, TIMEOUT_MS);
    child.stdout.on('data', (b) => { out += b; });
    child.stderr.on('data', (b) => { out += b; });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`lifecycle.py вийшов з кодом ${code}:\n${out.slice(-1500)}`));
    });
  });
}

// «Не зрозуміло» і «сторінка не прочиталась» — не однакові для всіх записів.
// Для табору з датами це причина не публікувати. Для вічної платформи —
// Khan Academy, CS50, Scratch — відкривати нічого: запис без жодної дати й із
// видом «постійна» не може «завершитись», а сторінки таких сайтів часто не
// пускають робота. Інакше ворота вирізали б із каналу саме те, що завжди
// доступне (перший прогін 20.09.2026: 11 відсіяних із 15, майже всі — платформи).
const UNKNOWN = new Set(['unclear', 'unreadable']);
const evergreen = (v) => v.kind === 'permanent' && !v.has_dates;

/**
 * Розбір вердиктів. Чиста функція — під тести.
 *
 * Правила:
 *   open + запис лишився активним          → публікуємо;
 *   ended / gone / upcoming                → ні, сезон не триває;
 *   не зрозуміло, але вічна платформа      → публікуємо;
 *   не зрозуміло в усьому іншому           → ні;
 *   вердикту немає взагалі                 → ні, мовчання не доказ.
 */
export function keepOpen(items, verdicts) {
  const kept = [];
  const dropped = [];
  for (const row of items) {
    const v = (verdicts || {})[row.id];
    if (!v) {
      dropped.push({ row, why: 'без вердикту' });
      continue;
    }
    const ok = v.status === 'active'
      && (v.state === 'open' || (UNKNOWN.has(v.state) && evergreen(v)));
    if (ok) kept.push(row);
    else dropped.push({ row, why: `${v.state}/${v.status || '—'}` });
  }
  return { kept, dropped };
}

/**
 * Лишає тільки ті записи, які перевірка визнала відкритими просто зараз.
 *
 * Повертає { items, dropped } — відсіяні йдуть у лог із причиною, щоб було
 * видно, чому пост коротший, ніж планувалось.
 *
 * Помилку перевірки НЕ ковтаємо: краще не надіслати пост, ніж надіслати
 * неперевірене. Викликач вирішує, чи це причина завершитись з помилкою.
 */
export async function verifyBeforePost(items, { label = '' } = {}) {
  const list = (items || []).filter(Boolean);
  if (!list.length || checkDisabled()) return { items: list, dropped: [] };

  const dir = await mkdtemp(join(tmpdir(), 'dityam-check-'));
  const jsonOut = join(dir, 'verdicts.json');
  try {
    await runLifecycle(list.map((r) => r.id), jsonOut);
    const verdicts = JSON.parse(await readFile(jsonOut, 'utf-8'));
    const { kept, dropped } = keepOpen(list, verdicts);
    for (const d of dropped) {
      console.log(`  ⛔ не публікуємо «${(d.row.title || d.row.slug || '').slice(0, 60)}» — перевірка: ${d.why}`);
    }
    if (dropped.length) {
      console.log(`Перевірка перед публікацією${label ? ` (${label})` : ''}: `
        + `лишилось ${kept.length} із ${list.length}.`);
    }
    return { items: kept, dropped };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
