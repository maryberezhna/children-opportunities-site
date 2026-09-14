import PlusLanding from '../../plus/PlusLanding';
import { supabase, publicOpportunities } from '@/lib/supabase';
import { PLUS_SALES_OPEN } from '@/lib/plus';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

// SEO/GEO — див. коментар в app/plus/page.js.
const TITLE = 'Dityam+: opportunities for your child and deadline reminders';
const DESCRIPTION = `Dityam+ subscription: every day we match opportunities to each child by age, interests and city, and remind you about deadlines. UAH 179/month.${PLUS_SALES_OPEN ? '' : ' Coming soon.'}`;

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/en/plus`,
    languages: { uk: `${SITE_URL}/plus`, en: `${SITE_URL}/en/plus` },
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: `${SITE_URL}/en/plus`,
    siteName: 'Dityam.com.ua',
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
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
