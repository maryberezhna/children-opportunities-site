import PlusLanding from './PlusLanding';
import { supabase, publicOpportunities } from '@/lib/supabase';

const SITE_URL = 'https://dityam.com.ua';

// Число можливостей у рядку довіри береться з бази, а не вписане руками:
// вписане застаріває за тиждень. Година — достатньо свіжо для цієї сторінки.
export const revalidate = 3600;

export const metadata = {
  title: 'Dityam+ — траєкторія розвитку дитини · скоро',
  description: 'Dityam+ памʼятає, куди ваша дитина вже подавалась, і пропонує наступний крок, а не випадкові картки. Нагадування про дедлайни за 7 і 2 дні. 179 грн/міс або 1 490 грн/рік. Станьте в список — першим знижка.',
  // Свого canonical тут не було, і сторінка успадковувала з layout адресу
  // головної — тобто казала Google, що вона дублікат головної.
  alternates: {
    canonical: `${SITE_URL}/plus`,
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

export default async function PlusPage() {
  const total = await activeCount();
  return <PlusLanding lang="uk" total={total} />;
}
