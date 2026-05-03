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
    ];
  },
};
