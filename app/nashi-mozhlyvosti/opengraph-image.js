// Власне прев'ю «Наших можливостей» (див. lib/og-own.js).
import { ownOgImage } from '@/lib/og-own';

export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Наші можливості Dityam.com.ua: олімпіади й Dityam+';

export default function Image() {
  return ownOgImage();
}
