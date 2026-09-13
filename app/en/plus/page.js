import PlusLanding from '../../plus/PlusLanding';
import { supabase, publicOpportunities } from '@/lib/supabase';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

export const metadata = {
  title: 'Dityam+ — a development path for your child · coming soon',
  description:
    'Dityam+ remembers where your child has already applied and suggests the next step, not random cards. Deadline reminders 7 and 2 days ahead. UAH 179/month or UAH 1,490/year. Join the list — early members get a discount.',
  alternates: {
    canonical: `${SITE_URL}/en/plus`,
    languages: { uk: `${SITE_URL}/plus`, en: `${SITE_URL}/en/plus` },
  },
};

async function activeCount() {
  if (!supabase) return null;
  try {
    const { count, error } = await publicOpportunities('id', { count: 'exact', head: true });
    return error ? null : count;
  } catch {
    return null;
  }
}

export default async function PlusPageEn() {
  const total = await activeCount();
  return <PlusLanding lang="en" total={total} />;
}
