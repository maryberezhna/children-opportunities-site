/**
 * Перевірка можливостей у готовому тексті поста (content/telegram/*.html)
 * перед публікацією.
 *
 * Навіщо (Марія, 26.10.2026: «перевіряй завжди на актуальність можливості
 * перед публікацією»). Пости, які скрипт каналу збирає сам із бази, уже йдуть
 * через verifyBeforePost. А готовий текст із файлу — ні: його написали
 * колись, і посилання dityam.com.ua/o/<slug> у ньому могли за цей час
 * закритись, змінити дату чи зовсім зникнути.
 *
 * Тут: витягнути з тексту всі /o/<slug>, взяти ці записи з бази й перевірити
 * двома кроками — спершу статус і дедлайн (без мережі), потім свіжим поглядом
 * на сторінку (verifyBeforePost → scraper/lifecycle.py --ids). Будь-яка
 * проблема — пост не йде; що саме не так, каже formatProblems для адмін-чату.
 */

const SLUG_RE = /dityam\.com\.ua\/(?:en\/)?o\/([a-z0-9][a-z0-9-]*)/gi;

/** Унікальні slug-и можливостей із тексту поста, у порядку появи. */
export function extractSlugs(text) {
  const out = [];
  for (const m of String(text || '').matchAll(SLUG_RE)) {
    const slug = m[1].toLowerCase();
    if (!out.includes(slug)) out.push(slug);
  }
  return out;
}

/**
 * Проблеми, які видно без сторінки: запису немає, він не активний, це дубль
 * або дедлайн уже минув. Чиста функція — під тести.
 * rows — записи з бази (slug, title, status, canonical_slug, deadline).
 */
export function linkProblems(slugs, rows, todayIso) {
  const bySlug = new Map((rows || []).map((r) => [r.slug, r]));
  const problems = [];
  for (const slug of slugs) {
    const r = bySlug.get(slug);
    if (!r) problems.push({ slug, why: 'такої можливості немає в базі' });
    else if (r.status !== 'active') problems.push({ slug, title: r.title, why: `на сайті не показується (статус ${r.status})` });
    else if (r.canonical_slug) problems.push({ slug, title: r.title, why: `злита з іншою (${r.canonical_slug})` });
    else if (r.deadline && String(r.deadline).slice(0, 10) < todayIso) {
      problems.push({ slug, title: r.title, why: `дедлайн ${String(r.deadline).slice(0, 10)} уже минув` });
    }
  }
  return problems;
}

/**
 * Повна перевірка тексту. supabase — клієнт із сервісним ключем; verify —
 * verifyBeforePost (або підміна в тестах). Помилку бази чи перевірки не
 * ковтаємо: краще не надіслати пост, ніж надіслати неперевірене.
 * Повертає { slugs, problems }.
 */
export async function checkPostLinks(text, { supabase, verify, todayIso, label = '' }) {
  const slugs = extractSlugs(text);
  if (!slugs.length) return { slugs, problems: [] };
  const { data, error } = await supabase.from('opportunities')
    .select('id, slug, title, status, canonical_slug, deadline, event_start_date, event_end_date')
    .in('slug', slugs);
  if (error) throw new Error(`база не відповіла: ${error.message}`);
  const problems = linkProblems(slugs, data, todayIso);
  const bad = new Set(problems.map((p) => p.slug));
  const live = (data || []).filter((r) => slugs.includes(r.slug) && !bad.has(r.slug));
  if (live.length && verify) {
    const { dropped } = await verify(live, { label });
    for (const d of dropped || []) {
      problems.push({ slug: d.row.slug, title: d.row.title, why: `сторінка організатора: ${d.why}` });
    }
  }
  return { slugs, problems };
}

/** Текст для адмін-чату: що за пост і що з ним не так. */
export function formatProblems(where, problems) {
  const lines = problems.map((p) => `• ${p.title ? `«${p.title.slice(0, 80)}»` : p.slug} — ${p.why}\n  dityam.com.ua/o/${p.slug}`);
  return `⚠️ Пост не пішов: ${where}\nМожливості в тексті вже неактуальні:\n${lines.join('\n')}\n\nВиправте текст або приберіть ці можливості.`;
}
