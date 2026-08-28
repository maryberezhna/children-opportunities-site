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

## Фон блоку можливостей (`backdrop.*`)

Смуга з відео над списком можливостей — `app/OpportunitiesBackdrop.js`.
Три файли: `backdrop.mp4`, `backdrop.webm` і постер `backdrop.jpg`.

Щоб підмінити відео, з вихідного кліпу:

```sh
SRC="шлях/до/кліпу.mp4"
ffmpeg -y -i "$SRC" -t 8 -an -vf "scale=1280:-2,fps=24" \
  -c:v libvpx-vp9 -crf 46 -b:v 0 -row-mt 1 public/backdrop.webm
ffmpeg -y -i "$SRC" -t 8 -an -vf "scale=1280:-2,fps=24" \
  -c:v libx264 -crf 32 -preset slow -pix_fmt yuv420p -movflags +faststart public/backdrop.mp4
ffmpeg -y -ss 1 -i "$SRC" -frames:v 1 -vf "scale=1280:-2" -q:v 4 public/backdrop.jpg
```

`-an` обов'язковий: доріжка звуку в фоновому відео не потрібна й лише важить.
`-t 8` — цикл на вісім секунд; довший цикл важчий, а різниці не видно.
Тримати кожен файл до ~800 КБ: більше — і смуга починає заважати сторінці,
заради якої вона стоїть.
