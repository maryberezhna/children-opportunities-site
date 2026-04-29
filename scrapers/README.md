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

## Schedule

`.github/workflows/scrape.yml` runs the scrapers every Monday 05:00 UTC and uploads the CSV as a workflow artifact (30-day retention). Trigger manually from the Actions tab via "Run workflow".
