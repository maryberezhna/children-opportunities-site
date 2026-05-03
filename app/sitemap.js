import { supabase } from '@/lib/supabase';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

export default async function sitemap() {
  const { data } = supabase
    ? await supabase.from('opportunities').select('slug, updated_at')
    : { data: [] };

  const opportunityEntries = (data || []).map((row) => ({
    url: `${SITE_URL}/?o=${row.slug}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    ...opportunityEntries,
  ];
}
