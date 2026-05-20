import { supabase } from '@/lib/supabase';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

export default async function sitemap() {
  const { data } = supabase
    ? await supabase.from('opportunities').select('slug, updated_at').eq('status', 'active')
    : { data: [] };

  const opportunityEntries = (data || []).map((row) => ({
    url: `${SITE_URL}/o/${row.slug}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const staticPages = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/contacts`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/support`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
  ].map((entry) => ({ ...entry, lastModified: new Date() }));

  return [...staticPages, ...opportunityEntries];
}
