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

  // Дві мовні версії кожної сторінки. alternates каже Google, що це та сама
  // можливість двома мовами, а не дубль: без цього англійська конкурувала б
  // з українською за той самий запит і обидві просіли б.
  const opportunityEntries = (data || []).flatMap((row) => {
    const lastModified = row.updated_at ? new Date(row.updated_at) : undefined;
    const changeFrequency = row.status === 'active' ? 'daily' : 'monthly';
    const languages = {
      uk: `${SITE_URL}/o/${row.slug}`,
      en: `${SITE_URL}/en/o/${row.slug}`,
    };
    return [
      {
        url: languages.uk,
        lastModified,
        changeFrequency,
        priority: row.status === 'active' ? 0.8 : 0.3,
        alternates: { languages },
      },
      {
        url: languages.en,
        lastModified,
        changeFrequency,
        // Трохи нижчий за український: оригінал лишається основною версією.
        priority: row.status === 'active' ? 0.7 : 0.3,
        alternates: { languages },
      },
    ];
  });

  // Сторінки, що мають англійський двійник: обидві версії з hreflang, щоб
  // Google склеїв їх як одну сторінку двома мовами, а не як дублі.
  const BILINGUAL = [
    { uk: '', en: '/en', changeFrequency: 'daily', priority: 1.0, priorityEn: 0.9 },
    { uk: '/about', en: '/en/about', changeFrequency: 'monthly', priority: 0.5 },
    { uk: '/yak-my-pereviriaiemo', en: '/en/how-we-verify', changeFrequency: 'monthly', priority: 0.5 },
    { uk: '/contacts', en: '/en/contacts', changeFrequency: 'monthly', priority: 0.4 },
    { uk: '/support', en: '/en/support', changeFrequency: 'monthly', priority: 0.4 },
    { uk: '/privacy', en: '/en/privacy', changeFrequency: 'yearly', priority: 0.2 },
    { uk: '/terms', en: '/en/terms', changeFrequency: 'yearly', priority: 0.2 },
  ];

  const bilingualPages = BILINGUAL.flatMap((entry) => {
    const languages = {
      uk: `${SITE_URL}${entry.uk}`,
      en: `${SITE_URL}${entry.en}`,
    };
    return [
      {
        url: languages.uk,
        changeFrequency: entry.changeFrequency,
        priority: entry.priority,
        alternates: { languages },
      },
      {
        url: languages.en,
        changeFrequency: entry.changeFrequency,
        // Трохи нижчий за український: оригінал лишається основною версією.
        priority: entry.priorityEn ?? Math.max(0.1, entry.priority - 0.1),
        alternates: { languages },
      },
    ];
  });

  const staticPages = [
    ...bilingualPages,
    { url: `${SITE_URL}/kategorii`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/press`, changeFrequency: 'monthly', priority: 0.4 },
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
