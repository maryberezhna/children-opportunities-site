import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows } from '@/lib/supabase';
import { CATEGORY_GROUPS, categoryHref } from '@/lib/categories';
import Footer from '../../Footer';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 300;

export const metadata = {
  title: 'Categories of opportunities for children — courses, camps, scholarships, contests',
  description:
    'Every category of opportunity for children 0–18 in one place: education, camps and exchanges, scholarships and grants, international programmes, contests, volunteering, careers. Live counts, updated daily.',
  alternates: {
    canonical: `${SITE_URL}/en/categories`,
    languages: { uk: `${SITE_URL}/kategorii`, en: `${SITE_URL}/en/categories` },
  },
};

async function getActive() {
  if (!supabase) return [];
  const { data } = await fetchAllRows(() => publicOpportunities().order('id'));
  return data || [];
}

export default async function CategoriesPage() {
  const items = await getActive();

  // Предикати лишаються ті самі, що й на українській сторінці: вони шукають по
  // українських полях бази, а не по підпису категорії. Тому лічильник тут і
  // там однаковий — і збігається з тим, що людина побачить після кліку.
  const groups = CATEGORY_GROUPS.map((g) => ({
    title: g.titleEn || g.title,
    items: g.items
      .map((it) => ({
        ...it,
        label: it.labelEn || it.label,
        href: categoryHref(it.href, 'en'),
        count: it.match ? items.filter(it.match).length : null,
      }))
      .filter((it) => it.count === null || it.count > 0),
  })).filter((g) => g.items.length > 0);

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/en` },
        { '@type': 'ListItem', position: 2, name: 'Categories', item: `${SITE_URL}/en/categories` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Categories of opportunities for children',
      numberOfItems: groups.reduce((n, g) => n + g.items.length, 0),
      itemListElement: groups.flatMap((g) => g.items).slice(0, 100).map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.label,
        url: `${SITE_URL}${it.href}`,
      })),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
      />
      <div className="container" lang="en">
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-badges">
              <Link href="/en" className="city-back-link">← All opportunities</Link>
            </div>
            <h1>
              Categories of opportunities
              <br />
              <span className="accent">for children 0–18</span>
            </h1>
            <p>
              Everything the catalogue collects, sorted by direction: from free
              courses and camps to scholarships, international programmes and
              contests. The number beside each one is how many opportunities it
              holds right now; empty categories are not shown.
            </p>
          </div>
        </div>

        {groups.map((g) => (
          <section key={g.title} className="category-group">
            <h2>{g.title}</h2>
            <div className="category-chips">
              {g.items.map((it) => (
                <Link key={it.label} href={it.href} className="category-chip">
                  {it.label}
                  {it.count !== null && (
                    <span className="category-count">{it.count}</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}

        <p className="topic-note">
          Cannot find your category? Write to us — the catalogue is updated daily,
          and we add new directions wherever verified opportunities appear.
        </p>
        <Footer lang="en" />
      </div>
    </>
  );
}
