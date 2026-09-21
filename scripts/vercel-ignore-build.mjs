/**
 * Ignored Build Step для Vercel: чи збирати сайт на цей коміт.
 *
 * Vercel запускає цей файл перед кожною збіркою (vercel.json → ignoreCommand).
 * Код виходу 0 — збірку пропустити, 1 — збирати.
 *
 * Навіщо. З 12 по 21.09.2026 Vercel зібрав сайт 420 разів (232 preview +
 * 188 продакшн) і з'їв $17.48 із $20 місячного кредиту за 9 днів. 74 зі 190
 * мерджів у main не чіпали сайт узагалі — лише скрапери, скрипти, воркфлоу,
 * міграції чи тести, — а кожен такий PR однаково збирав ~1080 сторінок двічі.
 *
 * Правило: пропускаємо, лише коли ВСІ змінені файли точно не потрапляють у
 * збірку. Будь-яка непевність — нема з чим порівняти, git упав, незнайомий
 * шлях — означає «збирати». Зайва збірка коштує центи, пропущена потрібна —
 * стару версію сайту на проді.
 *
 * Примусово зібрати: «[build]» у повідомленні коміту, або в Vercel →
 * Redeploy зняти галочку «Use project's Ignore Build Step».
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Теки, з яких до збірки не потрапляє нічого.
const NON_SITE_DIRS = ['scraper/', 'supabase/', 'tests/', '.github/', 'scripts/'];

// Винятки зі scripts/, без яких сайт не збереться. Список звіряє
// tests/vercel-ignore-build.test.mjs: якщо app/ чи lib/ почне імпортувати
// ще щось зі scripts/, тест упаде, доки файл не допишуть сюди.
export const SITE_SCRIPTS = [
  'scripts/check-catalogue-queries.mjs', // prebuild у package.json
  'scripts/channel-plan.mjs',            // app/admin/today/page.js
  'scripts/vercel-ignore-build.mjs',     // сам цей файл: зміну правил перевіряє збірка
];

/** Чи може зміна цього файлу змінити зібраний сайт. */
export function affectsSite(path) {
  if (SITE_SCRIPTS.includes(path)) return true;
  // Markdown у корені (README, CLAUDE.md) — документація, у збірку не йде.
  if (/^[^/]+\.md$/.test(path)) return false;
  return !NON_SITE_DIRS.some((dir) => path.startsWith(dir));
}

/** 0 — пропустити, 1 — збирати; плюс пояснення для лога збірки. */
export function decide(changedFiles, commitMessage = '') {
  if (/\[build\]/i.test(commitMessage)) return { code: 1, why: 'у коміті є [build]' };
  if (!changedFiles || changedFiles.length === 0) {
    return { code: 1, why: 'змін не знайдено — схоже на ручний Redeploy, збираємо' };
  }
  const site = changedFiles.filter(affectsSite);
  if (site.length > 0) {
    const shown = site.slice(0, 5).join(', ') + (site.length > 5 ? ` і ще ${site.length - 5}` : '');
    return { code: 1, why: `змінено файли сайту: ${shown}` };
  }
  return { code: 0, why: `сайт не змінився (${changedFiles.length} файлів поза збіркою)` };
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const hasCommit = (sha) => {
  try { git('cat-file', '-e', `${sha}^{commit}`); return true; } catch { return false; }
};

// Vercel клонує лише 10 останніх комітів гілки, main у клоні немає.
// Репозиторій публічний, тож дотягуємо потрібне анонімно.
function repoUrl() {
  const { VERCEL_GIT_REPO_OWNER: owner, VERCEL_GIT_REPO_SLUG: slug } = process.env;
  return owner && slug ? `https://github.com/${owner}/${slug}.git` : 'origin';
}

/** Коміт, з яким порівнювати, або null, якщо його не знайти. */
function findBase() {
  // Коміт останньої УСПІШНОЇ збірки цієї гілки: так у порівняння потрапляють
  // усі коміти після неї, зокрема ті, чию збірку пропустили чи вона впала.
  const previous = process.env.VERCEL_GIT_PREVIOUS_SHA;
  if (previous) {
    if (!hasCommit(previous)) {
      try { git('fetch', '-q', '--depth=1', repoUrl(), previous); } catch { return null; }
    }
    return hasCommit(previous) ? previous : null;
  }
  // Перша збірка гілки (новий PR): порівнюємо з точкою відгалуження від main.
  try {
    git('fetch', '-q', '--depth=100', repoUrl(), 'main');
    return git('merge-base', 'HEAD', 'FETCH_HEAD') || null;
  } catch {
    return null;
  }
}

function main() {
  const message = process.env.VERCEL_GIT_COMMIT_MESSAGE || '';
  const base = findBase();
  if (!base) {
    console.log('▶ Збираємо: не знайшли, з чим порівняти.');
    process.exit(1);
  }
  let files;
  try {
    files = git('diff', '--name-only', base, 'HEAD').split('\n').filter(Boolean);
  } catch {
    console.log(`▶ Збираємо: git diff ${base.slice(0, 7)}..HEAD не вдався.`);
    process.exit(1);
  }
  const { code, why } = decide(files, message);
  console.log(`${code === 0 ? '⏭ Пропускаємо збірку' : '▶ Збираємо'} (порівняння з ${base.slice(0, 7)}): ${why}`);
  process.exit(code);
}

// Тести імпортують функції; запуск напряму — це Vercel.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
