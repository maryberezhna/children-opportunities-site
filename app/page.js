import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows } from '@/lib/supabase';
import { kyivToday } from '@/lib/dates';
import OpportunitiesList from './OpportunitiesList';
import HomeHero from './HomeHero';
import HomeBlocks from './HomeBlocks';
import Footer from './Footer';
import { TOPIC_NAV } from '@/lib/topics';

export const revalidate = 300;

// Головна, редизайн (вересень 2026): крем-градієнт, хіро без фото, перемикач
// «Батькам / Підліткам» у шапці, автоматичний «Топ тижня», два нижні блоки
// (Telegram + «Запропонувати можливість»). Email-підписки, стікі-бар і
// плаваюче сердечко зняті свідомо — один заклик на екран.

async function getOpportunities() {
  if (!supabase) {
    console.warn('Supabase not configured — returning empty opportunities list');
    return [];
  }
  const { data, error } = await fetchAllRows(() =>
    publicOpportunities().order('created_at', { ascending: false }).order('id'));

  if (error) {
    console.error('Supabase error:', error);
    return [];
  }
  return data || [];
}

export default async function Home() {
  const opportunities = await getOpportunities();
  const total = opportunities.length;
  const freeCount = opportunities.filter(o => o.cost_type === 'free').length;
  const sourceCount = new Set(opportunities.map(o => o.source)).size;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Можливості для українських дітей',
    numberOfItems: opportunities.length,
    itemListElement: opportunities.slice(0, 100).map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://dityam.com.ua/o/${o.slug}`,
      name: o.title,
    })),
  };

  return (
    <div className="v2-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      <main className="v2-container">
        <HomeHero total={total} freeCount={freeCount} sourceCount={sourceCount} />

        <OpportunitiesList
          opportunities={opportunities}
          promoProps={{ total }}
          today={kyivToday()}
          modeAware
        />

        {/* Тихий рядок підбірок: найсильніше внутрішнє посилання на
            SEO-сторінки — з головної, але вже після каталогу. */}
        <nav className="v2-topics" aria-label="Підбірки за темами">
          <span className="v2-topics-label">Підбірки:</span>
          {TOPIC_NAV.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`}>{t.label}</Link>
          ))}
        </nav>

        <HomeBlocks />
      </main>

      <Footer />
    </div>
  );
}
