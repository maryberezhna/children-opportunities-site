import { pressStats } from '@/lib/press';
import PressKit from '../../PressKit';

const SITE_URL = 'https://dityam.com.ua';

export const metadata = {
  title: 'For media — dityam.com.ua press kit',
  description:
    'dityam.com.ua press kit: project figures, a ready-made description, coverage, logos and a contact for journalists. A platform of opportunities for Ukrainian children aged 0–18.',
  alternates: {
    canonical: `${SITE_URL}/en/press`,
    languages: { uk: `${SITE_URL}/press`, en: `${SITE_URL}/en/press` },
  },
};

export const revalidate = 3600;

export default async function PressPage() {
  const stats = await pressStats();
  return <PressKit stats={stats} lang="en" />;
}
