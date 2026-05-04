# Scrapers

Node-based scrapers that emit a CSV matching the Supabase `opportunities` table.

## Run

```bash
npm install
npm run scrape
```

Output: `scrapers/output/opportunities-YYYY-MM-DD.csv`

Import into Supabase via Table editor → **Insert** → **Import data from CSV**.

## What's included

| File | Source | Notes |
|---|---|---|
| `sources/acmodasi-castings.mjs` | acmodasi.com.ua | Дитячі кастинги (зйомки, реклама, кліпи) |
| `sources/constellation-ua.mjs` | constellation.org.ua | Міжнародні онлайн-конкурси мистецтв |
| `sources/fest-portal.mjs` | fest-portal.com | Всеукраїнські фестивалі/конкурси |
| `sources/regional-camps.mjs` | child.com.ua | Регіональні дитячі табори |
| `sources/international-competitions.mjs` | societyforscience.org | ISEF, Broadcom MASTERS, JIC + curated IOI/EUCYS/IOL |
| `sources/regional-language-schools.mjs` | afukraine.org | Альянс Франсез по містах України |

Each scraper has a **curated fallback** — if the live HTML structure changes
or the site is down, a small set of known opportunities is emitted instead so
the run never produces zero rows.

## Adding a new source

1. Create `sources/<name>.mjs` exporting `name` (string) and `scrape()` (async, returns array of partial rows).
2. Each partial row needs at minimum: `title`, `summary`, `age_from`, `age_to`, `opportunity_type`, `cost_type`, `source_url`, `source`. See `lib/normalize.mjs` for the validator and allowed enums.
3. Register the import in `run.mjs`.

`buildRow()` adds `slug` and `content_hash` automatically. `content_hash` is what Supabase uses to dedupe on import — use the existing column as the unique key on conflict.

## Insertion rules (`lib/rules.mjs`)

Every row that passes schema validation is then run through these rules. Failed rows go to `output/rejects-YYYY-MM-DD.txt` instead of the CSV; warnings print to stdout.

| Rule | What it does | Why |
|---|---|---|
| `nonEmptyTitle` | Reject if title < 5 chars | Keeps stub rows out |
| `nonEmptySummary` | Reject if summary < 30 chars | Search shows summary; thin = bad UX |
| `validUrl` | Reject if `source_url` is unparseable or non-http(s) | Avoids broken links |
| `notHardBlocked` | Reject if `source_url` is in `HARD_BLOCKED_URLS` | Two МАН pages were mass-duplicated historically; the curated row already exists |
| `ageWithinChildhood` | Reject if age range outside 0-17 | Catalog is for children only |
| `deadlineNotFarPast` | Reject if `deadline > 1 year ago` | Dead programs |
| `dedupHash` | Reject if `content_hash` already seen this run | Identical title+url collision |
| `dedupSourceUrl` | Reject if `source_url` already seen this run, **unless** it's in `LANDING_URLS` | Different opportunities can legitimately share a category landing page |
| `noLandingAsPrimary` | Warn if `source_url` is a landing page | Suggests scraper should drill deeper |

`normalizeFormat()` rewrites known format aliases (e.g. `Онлайн + офлайн` → `Гібрид`, `Офлайн Київ` → `Офлайн, Київ`) before validation, so the database stays consistent without per-scraper boilerplate. Add new aliases to `FORMAT_ALIASES` in `lib/rules.mjs`.

The `HARD_BLOCKED_URLS` list grew out of a real cleanup (May 2026: 21 МАН/InventorUA duplicates removed). When you add a new such URL: also add a row in the README's history note below.

### Hard-block history

- `2026-05-04` — `man.gov.ua/contests/.../konkurs-zahist-...` and `.../inventorua` after 19+2 duplicates were deleted from prod.

## Schedule

`.github/workflows/scrape.yml` runs the scrapers every Monday 05:00 UTC and uploads the CSV as a workflow artifact (30-day retention). Trigger manually from the Actions tab via "Run workflow".
