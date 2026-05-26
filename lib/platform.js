export function detectProvider(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/iphone|ipad|ipod|macintosh/.test(ua)) return 'apple';
  return 'google';
}
