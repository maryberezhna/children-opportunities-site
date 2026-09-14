// Власне прев'ю Dityam+ замість обкладинки головної (див. lib/og-plus.js).
import { plusOgImage } from '@/lib/og-plus';

export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Dityam+ — добірка можливостей для кожної дитини й нагадування про дедлайни';

export default function Image() {
  return plusOgImage('uk');
}
