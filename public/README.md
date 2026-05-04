# public/

Static assets served at the site root.

## Required files

- `og-image.png` — 1200×630 px Open Graph card used when the homepage
  or any opportunity page is shared on Facebook, LinkedIn, Slack,
  Telegram, X, etc. Referenced from `app/layout.js` and
  `app/o/[slug]/page.js`. Without this file the link previews fall
  back to a blank card.

## Adding `og-image.png`

1. Take the brand cover image (the "Усі можливості для дітей в одному місці" design).
2. Crop / scale to **1200×630 px** (any 1.91:1 image works; 1200×630 is the FB/LinkedIn target).
3. Export as PNG (≤ 1 MB ideally; ≤ 5 MB hard limit).
4. Save as `public/og-image.png`.
5. After the next deploy, validate via:
   - https://www.opengraph.xyz/?url=https%3A%2F%2Fdityam.com.ua
   - Telegram: paste the URL into a chat, the preview should refresh.
   - Or `curl -s https://dityam.com.ua | grep og:image`.
