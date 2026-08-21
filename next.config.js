/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/',
        has: [{ type: 'query', key: 'o', value: '(?<slug>.*)' }],
        destination: '/o/:slug',
        permanent: true,
      },
      // /events сторінкою ніколи не був — це технічний префікс флоу
      // «Додати в календар» (/events/[slug]/add). Але на нього два місяці
      // вів пункт меню, тож адреса встигла розійтись: 5 переходів у 404 за
      // 60 днів. Віддаємо 301 на головну, а не 404, щоб зовнішні посилання
      // й ті, у кого лишилась закладка, потрапляли в каталог.
      // Точний збіг: /events/<slug>/add під це правило не підпадає.
      {
        source: '/events',
        destination: '/',
        permanent: true,
      },
      // Календар свят видалено (1 перегляд за 60 днів, у sitemap не було).
      {
        source: '/sviata',
        destination: '/',
        permanent: true,
      },
    ];
  },
};
