import PlusLanding from '../../plus/PlusLanding';
import { supabase, publicOpportunities } from '@/lib/supabase';
import { kyivToday } from '@/lib/dates';
import { PLUS_SALES_OPEN } from '@/lib/plus';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

// SEO/GEO — див. коментар в app/plus/page.js.
const TITLE = 'Dityam+: opportunities for your child and deadline reminders';
const DESCRIPTION = `Dityam+ subscription: every day we match opportunities to each child by age, interests and city, and remind you about deadlines. UAH 119/month.${PLUS_SALES_OPEN ? '' : ' Coming soon.'}`;

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

// Три найближчі дедлайни для блоку «Кава чи можливість»: беремо рівно три
// рядки, а не весь каталог — сторінці більше не треба. Збій бази лише ховає
// блок (PlusChoice без записів не рендериться), сторінка лишається цілою.
async function soonestThree(today, fields) {
  if (!supabase) return [];
  try {
    const { data, error } = await publicOpportunities(fields)
      .gte('deadline', today)
      .order('deadline', { ascending: true })
      .limit(3);
    return error ? [] : (data || []);
  } catch {
    return [];
  }
}

export default async function PlusPageEn() {
  const today = kyivToday();
  const [total, picks] = await Promise.all([
    activeCount(),
    soonestThree(today, 'id, title, title_en, deadline'),
  ]);
  return <PlusLanding lang="en" total={total} picks={picks} today={today} />;
}
