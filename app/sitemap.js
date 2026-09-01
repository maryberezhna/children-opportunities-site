import { supabase, publicOpportunities, fetchAllRows } from '@/lib/supabase';
import { CITY_META } from '@/lib/cities';
import { TOPIC_LIST } from '@/lib/topics';
import { qualifyingCombos } from '@/lib/city-topics';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

export default async function sitemap() {
  // Закриті — теж у sitemap, із нижчим пріоритетом: сторінки живі (плашка
  // «завершилась»), індексовані, і Google має переобійти їх швидше — 114
  // з них досі висять у Search Console як 404 із часів, коли так і було.
  const { data } = supabase
    ? await fetchAllRows(() =>
        supabase.from('opportunities').select('slug, updated_at, status')
          .in('status', ['active', 'closed']).is('canonical_slug', null)
          .order('id'))
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
    { uk: '/refund', en: '/en/refund', changeFrequency: 'yearly', priority: 0.2 },
    { uk: '/press', en: '/en/press', changeFrequency: 'monthly', priority: 0.4 },
    { uk: '/kategorii', en: '/en/categories', changeFrequency: 'daily', priority: 0.8 },
    { uk: '/pidbirka', en: '/en/plus', changeFrequency: 'monthly', priority: 0.5 },
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

  // Календар дедлайнів поки лише українською, тож без alternates: обіцяти
  // Google англійську версію, якої немає, — це 404 у Search Console.
  const monolingual = [
    { url: `${SITE_URL}/dedlainy`, changeFrequency: 'daily', priority: 0.9 },
  ];

  const staticPages = [...bilingualPages, ...monolingual]
    .map((entry) => ({ ...entry, lastModified: new Date() }));

  const cityPages = Object.keys(CITY_META).flatMap((slug) => {
    const languages = { uk: `${SITE_URL}/${slug}`, en: `${SITE_URL}/en/${slug}` };
    return [
      { url: languages.uk, changeFrequency: 'daily', priority: 0.7, lastModified: new Date(), alternates: { languages } },
      { url: languages.en, changeFrequency: 'daily', priority: 0.6, lastModified: new Date(), alternates: { languages } },
    ];
  });

  // Тематичні підбірки: пріоритет вищий за міські, бо вони цілять у
  // категорійні запити, де каталог і має вигравати.
  const topicPages = TOPIC_LIST.flatMap((t) => {
    const languages = { uk: `${SITE_URL}/${t.slug}`, en: `${SITE_URL}/en/${t.en.slug}` };
    return [
      { url: languages.uk, changeFrequency: 'daily', priority: 0.9, lastModified: new Date(), alternates: { languages } },
      { url: languages.en, changeFrequency: 'daily', priority: 0.8, lastModified: new Date(), alternates: { languages } },
    ];
  });

  // «Місто × підбірка» — лише комбінації над порогом локальних записів:
  // ті самі правила, що в /[city]/[topic], інакше sitemap обіцяв би 404.
  // Українською без alternates: англійського двійника ці сторінки не мають.
  const { data: comboRows } = supabase
    ? await fetchAllRows(() =>
        publicOpportunities('title, cost_type, aid_type, opportunity_type, cities')
          .order('id'))
    : { data: [] };
  const cityTopicPages = qualifyingCombos(comboRows || []).map(({ citySlug, topicSlug }) => ({
    url: `${SITE_URL}/${citySlug}/${topicSlug}`,
    changeFrequency: 'daily',
    priority: 0.8,
    lastModified: new Date(),
  }));

  return [...staticPages, ...topicPages, ...cityPages, ...cityTopicPages, ...opportunityEntries];
}
