import Link from 'next/link';
import { supabase, publicOpportunities } from '@/lib/supabase';
import { opportunitiesWord, sourcesWord, freeWord } from '@/lib/plural';
import OpportunitiesList from './OpportunitiesList';
import SupportPopup from './SupportPopup';
import { TOPIC_NAV } from '@/lib/topics';
import StickyBar from './StickyBar';
import SubscribePopup from './SubscribePopup';
import Footer from './Footer';

export const revalidate = 300;

async function getOpportunities() {
  if (!supabase) {
    console.warn('Supabase not configured — returning empty opportunities list');
    return [];
  }
  const { data, error } = await publicOpportunities()
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

      <div className="container">
        <div className="hero">
          <div className="hero-copy">
          <div className="hero-badges">
            <div className="hero-badge">Безкоштовно і оновлюється щодня</div>
          </div>
          <h1>
            Усі можливості
            <br />
            <span className="accent">для вашої дитини</span>
            <br />
            в одному місці
          </h1>
          {/* «0-18 років» уже є в статистиці, «для дитини» — у заголовку;
              лід повторював обидва й займав три рядки замість двох. */}
          <p>
            Курси, олімпіади, стипендії, табори, медична допомога та виплати —
            в Україні та за кордоном. Кожну програму перевіряємо вручну.
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

          {/* Праворуч від тексту — жива фотографія замість порожнечі.
              webp із jpg-запасним варіантом; розміри задані, щоб верстка
              не стрибала, поки картинка вантажиться. */}
          <div className="hero-photo">
            <picture>
              <source srcSet="/hero-kids.webp" type="image/webp" />
              <img
                src="/hero-kids.jpg"
                width={880}
                height={543}
                alt="Усміхнені діти на дитячому майданчику"
                fetchPriority="high"
              />
            </picture>
          </div>
        </div>

        {/* Найсильніше внутрішнє посилання на підбірки — з головної, ще до
            каталогу: і людині швидший шлях до потрібного, і Google бачить, що
            ці сторінки для сайту важливі. */}
        <nav className="topic-chips" aria-label="Підбірки за темами">
          <span className="topic-chips-label">Підбірки:</span>
          {TOPIC_NAV.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`} className="topic-chip">
              {t.label}
            </Link>
          ))}
        </nav>

        {/* Dityam+ їде всередину каталогу — після перших карток. Перед ними
            він відсував першу можливість за згин: людина бачила пропозицію
            заплатити раніше, ніж те, за що платить.
            Передаємо пропси, а не готовий елемент: сторінка серверна, а
            функцію-фабрику в клієнтський компонент віддати не можна. */}
        <OpportunitiesList
          opportunities={opportunities}
          promoProps={{ total }}
        />

        <Footer />
      </div>

      {/* Плаваюче сердечко з модалкою підтримки — рівно одне на сторінку,
          на відміну від смуги Dityam+, що повторюється в каталозі. */}
      <SupportPopup />

      {/* ============ STICKY BAR — ВИНЕСЕНО В КЛІЄНТСЬКИЙ КОМПОНЕНТ ============ */}
      <StickyBar />

      {/* ============ АВТО-ПОП-АП ПІДПИСКИ (10 сек або 15 карток) ============ */}
      <SubscribePopup />
    </>
  );
}
