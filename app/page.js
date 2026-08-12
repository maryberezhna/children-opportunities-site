import { supabase, CARD_FIELDS } from '@/lib/supabase';
// Ціну читає серверний компонент: lib/wayforpay тягне crypto й секретний ключ,
// тож у клієнтський бандл він потрапити не має.
import { PRICE } from '@/lib/wayforpay';
import { opportunitiesWord, sourcesWord, freeWord } from '@/lib/plural';
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
    .select(CARD_FIELDS)
    .eq('status', 'active')
    // Дублі (canonical_slug заповнений) віддають 301 і в каталозі не потрібні.
    .is('canonical_slug', null)
    // Можливості Dityam+ у публічному каталозі не показуються — це
    // предмет підписки. Вони йдуть лише в персональну розсилку.
    .eq('plus_only', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase error:', error);
    return [];
  }
  return data || [];
}

// Приклад підбірки для блоку Dityam+ — СПРАВЖНІ можливості з каталогу.
// Вигаданий муляж обіцяв би те, чого в базі немає, а реальні дані ще й
// оновлюються самі.
//
// Спершу беремо ті, де подача відкрита — вони показують терміновість. Якщо
// таких мало (у каталозі лише кілька десятків із дедлайном, решта —
// довідкові курси й держпослуги), добираємо вічнозеленими. Інакше блок
// пустував би більшу частину року.
const MONTHS_SHORT = ['січ', 'лют', 'бер', 'квіт', 'трав', 'черв',
  'лип', 'сер', 'вер', 'жовт', 'лист', 'груд'];

function digestSample(opportunities, want = 3) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ageLabel = (o) =>
    o.age_from === 0 && o.age_to >= 17 ? '0-18 років' : `${o.age_from}-${o.age_to} років`;

  const list = opportunities || [];
  const openDeadline = (o) => {
    if (!o.deadline) return null;
    const d = new Date(o.deadline);
    return !isNaN(d) && d >= today ? d : null;
  };

  const urgent = list
    .filter((o) => openDeadline(o))
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  const evergreen = list
    .filter((o) => !o.deadline)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  return [...urgent, ...evergreen].slice(0, want).map((o) => {
    const d = openDeadline(o);
    return {
      slug: o.slug,
      title: o.title,
      age: ageLabel(o),
      cost: o.cost_type === 'free' ? 'безкоштовно' : null,
      deadline: d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : null,
    };
  });
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
            Курси, олімпіади, стипендії, табори, медична допомога та виплати для українських дітей 0-18 років —
            в Україні та за кордоном. Кожна програма перевірена вручну.
          </p>
          <div className="stats">
            <div className="stat">
              <span className="stat-num">{total}</span>
              <span className="stat-label">{opportunitiesWord(total)}</span>
            </div>
            <div className="stat">
              <span className="stat-num">{freeCount}</span>
              <span className="stat-label">{freeWord(freeCount)}</span>
            </div>
            <div className="stat">
              <span className="stat-num">{sourceCount}</span>
              <span className="stat-label">{sourcesWord(sourceCount)}</span>
            </div>
            <div className="stat">
              <span className="stat-num">0-18</span>
              <span className="stat-label">років</span>
            </div>
          </div>
        </div>

        <SupportPopup total={total} price={PRICE} sample={digestSample(opportunities)} />
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
