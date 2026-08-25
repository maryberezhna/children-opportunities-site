import { supabase } from '@/lib/supabase';
import { CITY_META } from '@/lib/cities';
import { TOPIC_LIST } from '@/lib/topics';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

export default async function sitemap() {
  // Закриті — теж у sitemap, із нижчим пріоритетом: сторінки живі (плашка
  // «завершилась»), індексовані, і Google має переобійти їх швидше — 114
  // з них досі висять у Search Console як 404 із часів, коли так і було.
  const { data } = supabase
    ? await supabase.from('opportunities').select('slug, updated_at, status')
        .in('status', ['active', 'closed']).is('canonical_slug', null)
    : { data: [] };

  const opportunityEntries = (data || []).map((row) => ({
    url: `${SITE_URL}/o/${row.slug}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
    changeFrequency: row.status === 'active' ? 'daily' : 'monthly',
    priority: row.status === 'active' ? 0.8 : 0.3,
  }));

  const staticPages = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/kategorii`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/en`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/yak-my-pereviriaiemo`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contacts`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/press`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/support`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ].map((entry) => ({ ...entry, lastModified: new Date() }));

  const cityPages = Object.keys(CITY_META).map((slug) => ({
    url: `${SITE_URL}/${slug}`,
    changeFrequency: 'daily',
    priority: 0.7,
    lastModified: new Date(),
  }));

  // Тематичні підбірки: пріоритет вищий за міські, бо вони цілять у
  // категорійні запити, де каталог і має вигравати.
  const topicPages = TOPIC_LIST.map((t) => ({
    url: `${SITE_URL}/${t.slug}`,
    changeFrequency: 'daily',
    priority: 0.9,
    lastModified: new Date(),
  }));

  return [...staticPages, ...topicPages, ...cityPages, ...opportunityEntries];
}
