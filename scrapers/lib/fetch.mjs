const UA = 'Mozilla/5.0 (compatible; dityam.com.ua-scraper/1.0; +https://dityam.com.ua)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchHtml(url, { retries = 2, delayMs = 800 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      if (i < retries) await sleep(delayMs * (i + 1));
    }
  }
  throw lastErr;
}

export async function politeBatch(items, fn, { concurrency = 1, delayMs = 600 } = {}) {
  const out = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const slice = items.slice(i, i + concurrency);
    const results = await Promise.allSettled(slice.map((it) => fn(it)));
    for (const r of results) {
      if (r.status === 'fulfilled') out.push(r.value);
      else console.error('  ! batch item failed:', r.reason?.message ?? r.reason);
    }
    if (i + concurrency < items.length) await sleep(delayMs);
  }
  return out;
}
