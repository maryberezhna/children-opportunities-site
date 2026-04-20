import { supabase } from '@/lib/supabase';
import OpportunitiesList from './OpportunitiesList';

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

  return (
    <div className="container">
      <div className="header">
        <h1>Можливості для дитини</h1>
        <p>Усі програми, курси, стипендії та підтримка для дітей 0-18 років в Україні</p>
      </div>
      <OpportunitiesList opportunities={opportunities} />
    </div>
  );
}
