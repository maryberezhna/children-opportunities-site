import { supabase } from '@/lib/supabase';
import OpportunitiesList from './OpportunitiesList';
import SupportPopup from './SupportPopup';
import StickyBar from './StickyBar';
import StickyHeader from './StickyHeader';
import SubscribePopup from './SubscribePopup';
import Footer from './Footer';

export const revalidate = 300;

async function getOpportunities() {
  if (!supabase) {
    console.warn('Supabase not configured — returning empty opportunities list');
    return [];
  }
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false });

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
    name: 'Можливості для дітей в Україні',
    numberOfItems: opportunities.length,
    itemListElement: opportunities.slice(0, 100).map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `https://dityam.com.ua/o/${o.slug}`,
      name: o.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <StickyHeader />

      <div className="container">
        <div className="hero">
          <div className="hero-badges">
            <div className="hero-badge">Безкоштовно і оновлюється щодня</div>
            <div className="beta-badge" title="Цей сайт у бета-тестуванні">
              <span className="beta-dot"></span>
              BETA
            </div>
          </div>
          <h1>
            Усі можливості
            <br />
            <span className="accent">для вашої дитини</span>
            <br />
            в одному місці
          </h1>
          <p>
            Курси, олімпіади, стипендії, табори, медична допомога та виплати для дітей 0-18 років в Україні.
            Всі перевірені програми зібрані в один каталог.
          </p>
          <div className="stats">
            <div className="stat">
              <span className="stat-num">{total}</span>
              <span className="stat-label">можливостей</span>
            </div>
            <div className="stat">
              <span className="stat-num">{freeCount}</span>
              <span className="stat-label">безкоштовних</span>
            </div>
            <div className="stat">
              <span className="stat-num">{sourceCount}</span>
              <span className="stat-label">джерел</span>
            </div>
            <div className="stat">
              <span className="stat-num">0-18</span>
              <span className="stat-label">років</span>
            </div>
          </div>
        </div>

        <SupportPopup />
        <OpportunitiesList opportunities={opportunities} />

        <Footer />
      </div>

      {/* ============ STICKY BAR — ВИНЕСЕНО В КЛІЄНТСЬКИЙ КОМПОНЕНТ ============ */}
      <StickyBar />

      {/* ============ АВТО-ПОП-АП ПІДПИСКИ (10 сек або 15 карток) ============ */}
      <SubscribePopup />
    </>
  );
}
