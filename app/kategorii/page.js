import Link from 'next/link';
import { supabase, publicOpportunities } from '@/lib/supabase';
import { CATEGORY_GROUPS } from '@/lib/categories';
import { opportunitiesWord } from '@/lib/plural';
import Footer from '../Footer';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 300;

export const metadata = {
  title: 'Категорії можливостей для дітей — курси, табори, стипендії, конкурси',
  description:
    'Всі категорії можливостей для дітей 0–18 в одному місці: освіта, табори й обміни, стипендії та гранти, міжнародні програми, конкурси, волонтерство, кар’єра. Живі лічильники, оновлюється щодня.',
  alternates: {
    canonical: `${SITE_URL}/kategorii`,
    // Взаємність обовʼязкова: односторонню анотацію Google ігнорує.
    languages: {
      uk: `${SITE_URL}/kategorii`,
      en: `${SITE_URL}/en/categories`,
    },
  },
};

async function getActive() {
  if (!supabase) return [];
  const { data } = await publicOpportunities();
  return data || [];
}

export default async function KategoriiPage() {
  const items = await getActive();

  // Лічильники тим самим предикатом, яким фільтрує каталог після кліку —
  // число на чіпі збігається з тим, що людина побачить. Порожні категорії
  // ховаємо: каталог росте, вони з'являться самі.
  const groups = CATEGORY_GROUPS.map((g) => ({
    title: g.title,
    items: g.items
      .map((it) => ({
        ...it,
        count: it.match ? items.filter(it.match).length : null,
      }))
      .filter((it) => it.count === null || it.count > 0),
  })).filter((g) => g.items.length > 0);

  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Головна', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Категорії', item: `${SITE_URL}/kategorii` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Категорії можливостей для дітей',
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
      <div className="container">
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-badges">
              <Link href="/" className="city-back-link">← Всі можливості</Link>
            </div>
            <h1>
              Категорії можливостей
              <br />
              <span className="accent">для дітей 0–18</span>
            </h1>
            <p>
              Все, що збирає каталог, — за напрямами: від безкоштовних курсів і
              таборів до стипендій, міжнародних програм і конкурсів. Число поруч —
              скільки можливостей у категорії просто зараз; порожні категорії не
              показуємо.
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
          Не знайшли свою категорію? Напишіть нам — каталог оновлюється щодня, і
          ми додаємо нові напрями там, де з’являються перевірені можливості.
        </p>
        <Footer />
      </div>
    </>
  );
}
