// Веб-маніфест. Next віддає його як /manifest.webmanifest і сам додає <link> у <head>.
export default function manifest() {
  return {
    name: 'Можливості для дитини — dityam.com.ua',
    short_name: 'Дітям',
    description:
      'Каталог безкоштовних можливостей для дітей 0-18 років в Україні: курси, олімпіади, стипендії, табори, медична допомога, виплати.',
    lang: 'uk',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fefcf7',
    theme_color: '#e85d24',
    categories: ['education', 'kids', 'social'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
