// Щоденна верифікація лінків усіх активних можливостей.
//
// Стан-машина на запис: ok → suspect → dead. Ніколи не ховаємо запис за один
// збій — лінки «воскресають» (тимчасові 5xx, таймаути, перевантаження). Лише
// після MAX_FAILURES невдалих ПЕРЕВІРОК ПОСПІЛЬ (= днів, бо запуск щоденний)
// запис закривається: status='closed', сторінка лишається в індексі з плашкою.
//
// Успішна перевірка ставить last_verified_at — сайт показує «Перевірено N днів
// тому». 403 і 429 вважаються живими: це бот-захист/ліміти, а не мертвий лінк.
//
// Софт-404: сторінка з 200 OK, але за змістом «не знайдено» — ловимо за
// заголовком/тілом і за редіректом на головну з глибокого шляху.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const DRY_RUN = process.env.DRY_RUN === 'true';
const MAX_FAILURES = Number(process.env.MAX_FAILURES || 3);
const CONCURRENCY = Number(process.env.CONCURRENCY || 10);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 12000);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const SOFT_404_RE = /(page not found|не знайдено|нічого не знайдено|сторінк[ау] видалено|сторінка не існує|404 error|error 404)/i;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DityamLinkCheck/1.0; +https://dityam.com.ua)',
        'Accept-Language': 'uk,en;q=0.8',
      },
      ...options,
    });
  } finally {
    clearTimeout(timer);
  }
}

// → { alive: boolean, reason: string }
async function checkUrl(url) {
  let res;
  try {
    res = await fetchWithTimeout(url, { method: 'HEAD' });
  } catch {
    res = null;
  }
  // Багато серверів не вміють HEAD (403/405/501) або рвуть з'єднання — GET.
  if (!res || res.status === 403 || res.status === 405 || res.status === 501 || res.status >= 500) {
    try {
      res = await fetchWithTimeout(url, { method: 'GET' });
    } catch (e) {
      return { alive: false, reason: `network: ${e.name === 'AbortError' ? 'timeout' : e.message}`.slice(0, 120) };
    }
  }

  const { status } = res;
  if (status === 403 || status === 429) return { alive: true, reason: `bot-protected ${status}` };
  if (status === 404 || status === 410) return { alive: false, reason: `http ${status}` };
  if (status >= 400) return { alive: false, reason: `http ${status}` };

  // 2xx: перевірка на софт-404.
  const originalPath = new URL(url).pathname;
  const finalPath = new URL(res.url).pathname;
  if (originalPath !== '/' && originalPath !== '' && (finalPath === '/' || finalPath === '')) {
    return { alive: false, reason: 'redirect to homepage' };
  }
  const contentType = res.headers.get('content-type') || '';
  if (res.body && contentType.includes('text/html')) {
    try {
      const reader = res.body.getReader();
      let html = '';
      const decoder = new TextDecoder();
      while (html.length < 20000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
      }
      await reader.cancel().catch(() => {});
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const h1Match = html.match(/<h1[^>]*>([\s\S]{0,300}?)<\/h1>/i);
      const probe = `${titleMatch?.[1] ?? ''} ${h1Match?.[1] ?? ''}`;
      if (SOFT_404_RE.test(probe)) return { alive: false, reason: 'soft 404' };
    } catch {
      // тіло не дочиталось — статус 2xx уже отримали, вважаємо живим
    }
  }
  return { alive: true, reason: `http ${status}` };
}

async function loadActive() {
  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('opportunities')
      .select('id, slug, title, source_url, link_status, link_failures')
      .eq('status', 'active')
      .not('source_url', 'is', null)
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`select failed: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function run() {
  const rows = await loadActive();
  console.log(`Перевіряю ${rows.length} активних лінків (макс ${CONCURRENCY} одночасно)…`);

  const now = new Date().toISOString();
  const results = { ok: 0, suspect: 0, closed: 0, recovered: 0 };
  const newlyClosed = [];
  const queue = [...rows];

  async function worker() {
    for (;;) {
      const row = queue.shift();
      if (!row) return;
      const { alive, reason } = await checkUrl(row.source_url);

      let patch;
      if (alive) {
        if (row.link_status !== 'ok') results.recovered += 1;
        results.ok += 1;
        patch = { link_status: 'ok', link_failures: 0, link_checked_at: now, last_verified_at: now };
      } else {
        const failures = (row.link_failures || 0) + 1;
        if (failures >= MAX_FAILURES) {
          results.closed += 1;
          newlyClosed.push({ ...row, reason });
          patch = {
            link_status: 'dead',
            link_failures: failures,
            link_checked_at: now,
            status: 'closed',
            admin_comment: `auto: лінк недоступний ${failures} перевірки поспіль (${reason})`,
            updated_at: now,
          };
        } else {
          results.suspect += 1;
          patch = { link_status: 'suspect', link_failures: failures, link_checked_at: now };
        }
        console.log(`  ✗ ${reason}  ${row.source_url}`);
      }

      if (!DRY_RUN) {
        const { error } = await supabase.from('opportunities').update(patch).eq('id', row.id);
        if (error) console.error(`  update failed for ${row.id}: ${error.message}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nЖивих: ${results.ok} (з них відновилось: ${results.recovered})`);
  console.log(`Підозрілих (${'<'}${MAX_FAILURES} збоїв): ${results.suspect}`);
  console.log(`Закрито як мертві: ${results.closed}`);

  if (newlyClosed.length && TELEGRAM_BOT_TOKEN && TELEGRAM_ADMIN_CHAT_ID && !DRY_RUN) {
    const lines = newlyClosed.slice(0, 20).map(
      (r) => `• ${r.title.slice(0, 60)}\n  ${r.source_url}`,
    );
    const text = [
      `🔗 Верифікація лінків: закрито ${newlyClosed.length} записів з мертвими лінками`,
      '',
      ...lines,
      newlyClosed.length > 20 ? `…і ще ${newlyClosed.length - 20}` : '',
      '',
      'Сторінки лишились в індексі з плашкою «завершено». Якщо лінк живий — відкрий запис в адмінці й поверни active.',
    ].filter(Boolean).join('\n');
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_ADMIN_CHAT_ID, text, disable_web_page_preview: true }),
    }).catch((e) => console.error('Telegram notify failed:', e.message));
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
