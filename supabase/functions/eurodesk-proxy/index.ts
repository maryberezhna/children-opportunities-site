// Посередник для Eurodesk Opportunity Finder (programmes.eurodesk.eu).
//
// Навіщо. Сайт відповідає 403 на запити з адрес GitHub Actions, де живе
// нічний скрап: 21.09.2026 прогін дав «403 Forbidden», а з домашньої мережі
// той самий запит — 200 і 534 програми. Джерело мовчки віддавало нуль і
// рахувалось «успішним». Тут той самий запит іде з адрес Supabase.
//
// Розбір лишається в Python (scraper/scrapers/eurodesk.py): функція лише
// приносить сирий HTML. Щоб не возити 8–17 МБ, вирізаємо те, чого розбір не
// читає: CSS-класи, картинки, зайві пробіли й ~135 мов на картку (лишається
// одна <option> з ідентифікатором «21214-eu»). 8,8 → 3,2 МБ, а записи, які
// розбирає скрапер, ті самі до символу (звірено 21.09.2026).
//
// Доступ: ?probe=1 — лише коди відповіді й кількість (будь-який ключ
// проєкту); дані — тільки з ключем service_role, щоб це не стало відкритим
// проксі.
//
// Розгортання: MCP deploy_edge_function або `supabase functions deploy
// eurodesk-proxy`, verify_jwt = true.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BASE = "https://programmes.eurodesk.eu";
const BROWSER = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "en-GB,en;q=0.9",
};

function role(req: Request): string | null {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

const cookieHeader = (jar: Map<string, string>) =>
  [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

// Сесія: головна ставить куки (і редіректить), без них /search дає 403.
async function session(): Promise<{ cookie: string; status: number }> {
  const jar = new Map<string, string>();
  let url = `${BASE}/`;
  let status = 0;
  for (let hop = 0; hop < 6; hop++) {
    const r = await fetch(url, {
      redirect: "manual",
      headers: { ...BROWSER, ...(jar.size ? { Cookie: cookieHeader(jar) } : {}) },
    });
    status = r.status;
    for (const c of r.headers.getSetCookie()) {
      const pair = c.split(";")[0];
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
    await r.body?.cancel();
    const loc = r.headers.get("location");
    if (status >= 300 && status < 400 && loc) {
      url = new URL(loc, url).toString();
      continue;
    }
    break;
  }
  return { cookie: cookieHeader(jar), status };
}

// Лише те, що читає розбір: data-role, data-color, текст і одна <option>.
function compact(html: string): string {
  return html
    .replace(/(<select\b[^>]*>)([\s\S]*?)(<\/select>)/gi, (_m, open, inner, close) => {
      const keep = inner.match(/<option\b[^>]*value="\d+-[^"]*"[^>]*>[^<]*<\/option>/i);
      return open + (keep ? keep[0] : "") + close;
    })
    .replace(/\sclass="[^"]*"/g, "")
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/\s{2,}/g, " ");
}

const sectionHtml = (s: unknown): string =>
  s && typeof s === "object" ? String((s as { html?: string }).html ?? "") : String(s ?? "");

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const probe = url.searchParams.get("probe") === "1";
  if (!probe && role(req) !== "service_role") {
    return Response.json({ ok: false, error: "service_role only" }, { status: 403 });
  }

  try {
    const { cookie, status: homeStatus } = await session();
    const r = await fetch(`${BASE}/search?all=1`, {
      headers: {
        ...BROWSER,
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        Referer: `${BASE}/`,
        Cookie: cookie,
      },
    });
    if (!r.ok) {
      await r.body?.cancel();
      return Response.json({ ok: false, home: homeStatus, search: r.status }, { status: 502 });
    }
    const data = await r.json();
    const open = sectionHtml(data.open);
    const upcoming = sectionHtml(data.upcoming);
    const cards = (h: string) => (h.match(/data-role="card"/g) || []).length;

    if (probe) {
      return Response.json({
        ok: true, home: homeStatus, search: r.status, count: data.count,
        open_cards: cards(open), upcoming_cards: cards(upcoming),
        open_bytes: open.length, open_compact_bytes: compact(open).length,
      });
    }

    const want = url.searchParams.get("section") || "open";
    return Response.json({
      ok: true,
      count: data.count,
      open: want === "upcoming" ? null : { html: compact(open) },
      upcoming: want === "open" ? null : { html: compact(upcoming) },
    });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 502 });
  }
});
