#!/usr/bin/env python3
"""Фото для статей блогу (22.10.2026).

Марія: «знайти фото; фото не мають повторюватися у блозі». Кожна стаття має
власне фото в public/blog/<slug>. Беремо лише з Wikimedia Commons і лише з
ліцензією CC0 або суспільне надбання — такі фото можна ставити без підпису
автора (правило «безкоштовні стоки без вказання автора»). Unsplash і Pexels
без ключа віддають 403, Openverse часто відповідає 504.

Кого показуємо — правило Марії (memory: dityam-collection-photo-rule):
лише білі діти й дорослі, Україна або нейтральне тло; ніяких темношкірих
людей, авто, війни, чужих маркерів (англійські написи, американський клас).
Найпростіше — фото БЕЗ людей: речі, природа, будівлі. Кожного кандидата
треба переглянути очима (Read на мініатюрі) до вибору.

  python3 scripts/blog_photo.py search "school supplies" [--limit 12]
      → список кандидатів CC0/PD і мініатюри в /tmp/blog-photo/<n>.jpg
  python3 scripts/blog_photo.py make <url оригіналу> <slug> [--y 0.5]
      → public/blog/<slug>.jpg/.webp і <slug>-450.jpg/.webp (3:2, 900×600 і 450×300)

Потрібен Pillow: python3 -m pip install --quiet pillow
Завантаження — через curl (у Python на macOS буває збій SSL-сертифікатів).
"""
import json
import os
import re
import subprocess
import sys
import urllib.parse

UA = 'DityamBlogPhoto/1.0 (https://dityam.com.ua; hellodityam.com.ua@gmail.com)'
API = 'https://commons.wikimedia.org/w/api.php'
FREE = re.compile(r'^(cc0|public domain|pd|no restrictions)', re.I)
THUMBS = '/tmp/blog-photo'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'blog')


def curl(url, dest=None):
    args = ['curl', '-sSL', '--max-time', '60', '-A', UA, url]
    if dest:
        args += ['-o', dest]
    r = subprocess.run(args, capture_output=True, check=True)
    return r.stdout


def search(query, limit=12):
    params = {
        'action': 'query', 'format': 'json', 'generator': 'search', 'gsrnamespace': 6,
        'gsrsearch': f'{query} filetype:bitmap', 'gsrlimit': 50, 'prop': 'imageinfo',
        'iiprop': 'url|size|extmetadata', 'iiextmetadatafilter': 'LicenseShortName|ImageDescription',
        'iiurlwidth': 600,
    }
    data = json.loads(curl(API + '?' + urllib.parse.urlencode(params)))
    pages = sorted(data.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 0))
    os.makedirs(THUMBS, exist_ok=True)
    found = []
    for p in pages:
        ii = (p.get('imageinfo') or [{}])[0]
        lic = ii.get('extmetadata', {}).get('LicenseShortName', {}).get('value', '')
        w, h = ii.get('width', 0), ii.get('height', 0)
        # Лише вільні від підпису, достатньо великі й горизонтальні або квадратні.
        if not FREE.match(lic) or w < 900 or h < 600 or h > w * 1.1:
            continue
        n = len(found) + 1
        thumb = os.path.join(THUMBS, f'{n}.jpg')
        curl(ii['thumburl'], thumb)
        found.append({'n': n, 'title': p['title'], 'license': lic, 'size': f'{w}x{h}',
                      'url': ii['url'], 'page': ii.get('descriptionurl'), 'thumb': thumb})
        if len(found) >= limit:
            break
    print(json.dumps(found, ensure_ascii=False, indent=1))
    if not found:
        print('Нічого з CC0/PD — спробуй інший запит англійською (предмети, природа, будівлі).', file=sys.stderr)


def make(url, slug, y=0.5):
    from PIL import Image  # python3 -m pip install pillow
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        sys.exit('slug — латиниця через дефіс')
    os.makedirs(OUT, exist_ok=True)
    src = os.path.join(THUMBS, f'src-{slug}')
    os.makedirs(THUMBS, exist_ok=True)
    curl(url, src)
    im = Image.open(src).convert('RGB')
    w, h = im.size
    # Обрізка до 3:2; y — де по вертикалі тримати кадр (0 — верх, 1 — низ).
    if w / h > 1.5:
        nw = int(h * 1.5)
        box = ((w - nw) // 2, 0, (w - nw) // 2 + nw, h)
    else:
        nh = int(w / 1.5)
        top = int((h - nh) * min(max(y, 0), 1))
        box = (0, top, w, top + nh)
    im = im.crop(box)
    for suffix, size in (('', (900, 600)), ('-450', (450, 300))):
        r = im.resize(size, Image.LANCZOS)
        r.save(os.path.join(OUT, f'{slug}{suffix}.jpg'), 'JPEG', quality=82, optimize=True, progressive=True)
        r.save(os.path.join(OUT, f'{slug}{suffix}.webp'), 'WEBP', quality=78, method=6)
    print(f'/blog/{slug} — збережено 4 файли в public/blog/')


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] == 'search':
        lim = int(a[a.index('--limit') + 1]) if '--limit' in a else 12
        search(a[1], lim)
    elif len(a) >= 3 and a[0] == 'make':
        yy = float(a[a.index('--y') + 1]) if '--y' in a else 0.5
        make(a[1], a[2], yy)
    else:
        sys.exit(__doc__)
