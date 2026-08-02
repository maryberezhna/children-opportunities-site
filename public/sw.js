// Service worker для offline-режиму. Мета вузька: родина з поганим інтернетом
// має бачити вже відкриті сторінки каталогу, а не помилку браузера.
//
// Стратегії:
//   навігації      — network-first, кеш як запасний варіант, /offline як останній
//   /_next/static  — cache-first (файли з хешем у назві, вони незмінні)
//   решта GET      — stale-while-revalidate
//   API / admin    — не кешуємо взагалі
//
// Версію піднімати при зміні логіки: старі кеші чистяться в activate.
const VERSION = 'v1';
const PAGES = `dityam-pages-${VERSION}`;
const ASSETS = `dityam-assets-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES).then((cache) => cache.addAll([OFFLINE_URL, '/icon-192.png']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== PAGES && k !== ASSETS).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Свіжі дані важливіші за швидкість: дедлайни змінюються, а показати вчорашній
// список краще лише тоді, коли мережі справді немає.
async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw new Error('offline');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Ніколи не кешуємо: дані підписників, оплати, модерацію, службові маршрути.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname === '/sw.js'
  ) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
