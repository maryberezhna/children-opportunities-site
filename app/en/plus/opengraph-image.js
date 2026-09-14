// English preview for Dityam+ (see lib/og-plus.js).
import { plusOgImage } from '@/lib/og-plus';

export const runtime = 'nodejs';
export const revalidate = 86400;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Dityam+ — opportunities matched to each child, plus deadline reminders';

export default function Image() {
  return plusOgImage('en');
}
