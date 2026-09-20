import PlusLanding from './PlusLanding';
import { supabase, publicOpportunities } from '@/lib/supabase';
import { PLUS_SALES_OPEN } from '@/lib/plus';

const SITE_URL = 'https://dityam.com.ua';

// Число можливостей у рядку довіри береться з бази, а не вписане руками:
// вписане застаріває за тиждень. Година — достатньо свіжо для цієї сторінки.
export const revalidate = 3600;

// SEO/GEO (14.09.2026). Заголовок — absolute, бо шаблон layout дописує
// «| Можливості для дитини», і виходило 68 символів із двома назвами. Опис
// до 160 символів: довший Google обрізає. OG і Twitter — свої: раніше
// сторінка брала прев'ю головної, і в Telegram посилання на Dityam+
// виглядало як «Усі можливості для дитини». Жодної обіцянки, якої немає в коді.
const TITLE = 'Dityam+: можливості для дитини й нагадування про дедлайни';
const DESCRIPTION = `Підписка Dityam+: щодня добираємо можливості для кожної дитини за віком, вподобаннями й містом і нагадуємо про дедлайни. 119 грн/міс.${PLUS_SALES_OPEN ? '' : ' Скоро.'}`;

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  // Свого canonical тут не було, і сторінка успадковувала з layout адресу
  // головної — тобто казала Google, що вона дублікат головної.
  alternates: {
    canonical: `${SITE_URL}/plus`,
    languages: { uk: `${SITE_URL}/plus`, en: `${SITE_URL}/en/plus` },
  },
  openGraph: {
    type: 'website',
    locale: 'uk_UA',
    url: `${SITE_URL}/plus`,
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

export default async function PlusPage() {
  const total = await activeCount();
  return <PlusLanding lang="uk" total={total} />;
}
