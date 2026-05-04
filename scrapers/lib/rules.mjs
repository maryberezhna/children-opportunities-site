// ============================================================
// Insertion rules — guard the opportunities table from quality regressions.
// Used by scrapers/run.mjs after a row is built and before CSV emission.
// Each rule returns { ok, reason } so the runner can log a structured
// reject log per skipped row.
// ============================================================

// ---- Format normalization ---------------------------------------------------
// Source-of-truth for canonical format strings. Any new scraper output that
// matches a key on the LEFT is rewritten to the value on the RIGHT *before*
// validation runs, so the database stays consistent.
export const FORMAT_ALIASES = {
  'Онлайн + офлайн': 'Гібрид',
  'Офлайн + онлайн': 'Гібрид',
  'Офлайн+онлайн': 'Гібрид',
  'Офлайн/онлайн': 'Гібрид',
  'online': 'Онлайн',
  'очний': 'Офлайн',
  'Школи': 'Офлайн у школах',
  'Офлайн Київ': 'Офлайн, Київ',
  'Офлайн Львів': 'Офлайн, Львів',
  'Офлайн Одеса': 'Офлайн, Одеса',
  'Офлайн Карпати': 'Офлайн, Карпати',
  'Офлайн Польща': 'Офлайн, Польща',
  'Офлайн США': 'Офлайн, США',
  'За кордоном США': 'Офлайн, США',
  'За кордоном Німеччина': 'Офлайн, Німеччина',
  'За кордоном Канада': 'Офлайн, Канада',
  'За кордоном Китай': 'Офлайн, Китай',
  'За кордоном Скандинавія': 'Офлайн, Скандинавія',
};

export function normalizeFormat(value) {
  if (!value) return value;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (FORMAT_ALIASES[trimmed]) return FORMAT_ALIASES[trimmed];
  // Generic "Офлайн <City>" → "Офлайн, <City>"
  const m = trimmed.match(/^(Офлайн)\s+([А-ЯҐЄІЇA-Z][^,]+)$/);
  if (m && !trimmed.includes(',')) return `${m[1]}, ${m[2]}`;
  return trimmed;
}

// ---- Source-URL exclusion list ---------------------------------------------
// Generic landing/category pages that several distinct opportunities legitimately
// share (and therefore must NOT be used as the dedup key). These are also
// flagged as "weak" source URLs — scrapers should try to drill down to a more
// specific page.
export const LANDING_URLS = new Set([
  'https://man.gov.ua/contests',
  'https://www.pfu.gov.ua/',
  'https://mms.gov.ua/',
  'https://diia.gov.ua/services',
  'https://mcip.gov.ua/',
  'https://klitschkofoundation.org/projects/',
  'https://mon.gov.ua/osvita-2/zagalna-serednya-osvita/olimpiadi-ta-konkursi',
  'https://constellation.org.ua/',
  'https://fest-portal.com/meropriyatiya/',
]);

// Specific URLs that have historically been mass-duplicated (usually because
// scrapers re-discovered the same upstream contest under different titles).
// Hard-block any insertion that targets these — they already have a single
// curated row in the DB; scrapers should reuse it instead of inserting again.
export const HARD_BLOCKED_URLS = new Set([
  'https://man.gov.ua/contests/olympiad/konkurs-zahist-naukovo-doslidnicskih-robit-uchniv-chleniv-man',
  'https://man.gov.ua/contests/vseukrayinsskij-konkurs-molodizhnih-naukovo-tehnichnih-proyektiv-inventorua',
]);

// ---- Validation rules ------------------------------------------------------
// Each rule: (row, ctx) -> { ok: boolean, reason?: string }.
// `ctx.seenHashes` is a Set of content_hash values already accepted in this run,
// `ctx.seenUrls` is a Set of source_urls already accepted in this run.
const rules = [
  function nonEmptyTitle(row) {
    if (!row.title || row.title.trim().length < 5) {
      return { ok: false, reason: 'title too short (<5 chars)' };
    }
    return { ok: true };
  },

  function nonEmptySummary(row) {
    if (!row.summary || row.summary.trim().length < 30) {
      return { ok: false, reason: 'summary too short (<30 chars)' };
    }
    return { ok: true };
  },

  function validUrl(row) {
    try {
      const u = new URL(row.source_url);
      if (!['http:', 'https:'].includes(u.protocol)) {
        return { ok: false, reason: 'non-http(s) source_url' };
      }
    } catch {
      return { ok: false, reason: 'unparseable source_url' };
    }
    return { ok: true };
  },

  function notHardBlocked(row) {
    if (HARD_BLOCKED_URLS.has(row.source_url)) {
      return { ok: false, reason: 'source_url is hard-blocked (already curated in DB)' };
    }
    return { ok: true };
  },

  function ageWithinChildhood(row) {
    if (row.age_from < 0 || row.age_to > 17) {
      return { ok: false, reason: `age range ${row.age_from}-${row.age_to} outside 0-17` };
    }
    return { ok: true };
  },

  function deadlineNotFarPast(row) {
    if (!row.deadline) return { ok: true };
    const d = new Date(row.deadline);
    if (isNaN(d.getTime())) return { ok: false, reason: 'unparseable deadline' };
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    if (d < yearAgo) {
      return { ok: false, reason: `deadline ${row.deadline} is more than a year in the past` };
    }
    return { ok: true };
  },

  function dedupHash(row, ctx) {
    if (ctx.seenHashes.has(row.content_hash)) {
      return { ok: false, reason: `duplicate content_hash within this run` };
    }
    return { ok: true };
  },

  function dedupSourceUrl(row, ctx) {
    if (LANDING_URLS.has(row.source_url)) return { ok: true };  // landing pages are shared legitimately
    if (ctx.seenUrls.has(row.source_url)) {
      return { ok: false, reason: `duplicate source_url within this run` };
    }
    return { ok: true };
  },

  function noLandingAsPrimary(row) {
    // Allow but warn: a scraper emitting only the landing page suggests it
    // failed to drill down. We accept it but flag in the reason for visibility.
    if (LANDING_URLS.has(row.source_url)) {
      return { ok: true, warning: 'using landing/category URL — try to find a more specific upstream link' };
    }
    return { ok: true };
  },
];

export function applyRules(row, ctx) {
  // Apply normalization first (mutates row in place)
  row.format = normalizeFormat(row.format);

  const reasons = [];
  const warnings = [];
  for (const rule of rules) {
    const result = rule(row, ctx);
    if (!result.ok) reasons.push(result.reason);
    if (result.warning) warnings.push(result.warning);
  }

  return {
    ok: reasons.length === 0,
    reasons,
    warnings,
  };
}
