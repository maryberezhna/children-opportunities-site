import { supabase } from '@/lib/supabase';
import OpportunitiesList from './OpportunitiesList';
import SupportPopup from './SupportPopup';

export const revalidate = 300;

async function getOpportunities() {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
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

  return (
    <div className="container">
      <div className="hero">
        <div className="hero-badge">Безкоштовно і оновлюється щодня</div>
        <h1>
          Усі можливості <span className="accent">для вашої дитини</span> в одному місці
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

      <OpportunitiesList opportunities={opportunities} />
      <SupportPopup />
    </div>
  );
}
