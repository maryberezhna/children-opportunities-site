import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow } from '@/lib/supabase';
import { kyivToday } from '@/lib/dates';
import { audienceStats, visibleFor } from '@/lib/audience';
import { topWeekCards } from '@/lib/weekly-top';
import { isoWeek } from '@/lib/week';
import { daysUntil } from '@/lib/dates';
import OpportunitiesList from './OpportunitiesList';
import HomeHero from './HomeHero';
import HomeTopics from './HomeTopics';
import HomeBlocks from './HomeBlocks';
import Footer from './Footer';
import SubscribePopup from './SubscribePopup';
import { TOPIC_NAV } from '@/lib/topics';

export const revalidate = 300;

// Головна, редизайн 29.09.2026 (макет Main.dc.html / Mobile.dc.html): хіро з
// пошуком, плитками тем і «Встигніть цього тижня» праворуч, фільтри лише в
// бічній панелі, олімпіади МОН однією карткою, два нижні блоки (Telegram +
// «Запропонувати можливість»). На телефоні: заголовок → пошук → вік →
// «Встигніть цього тижня» → список → канал → «Або оберіть тему» → блок для
// організаторів, знизу панель «Фільтри / Сортування». Email-підписки,
// стікі-бар і плаваюче сердечко зняті свідомо — один заклик на екран.

async function getOpportunities() {
  if (!supabase) {
    console.warn('Supabase not configured — returning empty opportunities list');
    return [];
  }
  // Помилка бази кидається, а не стає порожнім списком (див. rowsOrThrow).
  return rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities().order('created_at', { ascending: false }).order('id')), 'home');
}

export default async function Home() {
  const opportunities = await getOpportunities();
  const today = kyivToday();
  // Дві трійки цифр: у режимі «Підліткам» хіро показує підліткові, а не
  // загальні — інакше воно обіцяє більше, ніж каталог під ним покаже.
  const stats = audienceStats(opportunities, today);
  const teenStats = audienceStats(opportunities, today, true);
  // Трійка «Встигніть цього тижня» для хіро — та сама, що раніше рахував
  // список як «Топ тижня» (відмічені в адмінці + найближчі дедлайни). Список
  // на десктопі її більше не показує, але й далі вилучає зі стрічки.
  const week = isoWeek();
  const slim = (o) => ({
    slug: o.slug, title: o.title, title_en: o.title_en || null, deadline: o.deadline || null,
    opportunity_type: o.opportunity_type, age_from: o.age_from, age_to: o.age_to, cost_type: o.cost_type || null,
  });
  const soon = topWeekCards({ items: visibleFor(opportunities, today), week, todayIso: today, daysUntil }).map(slim);
  const teenSoon = topWeekCards({ items: visibleFor(opportunities, today, true), week, todayIso: today, daysUntil }).map(slim);

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
    <div className="v2-page v2-home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      <HomeHero stats={stats} teenStats={teenStats} soon={soon} teenSoon={teenSoon} today={today} />

      <main className="v2-container" id="catalog">
        <OpportunitiesList
          opportunities={opportunities}
          today={today}
          modeAware
          mobileLayout
          sidebarLayout
          // 40, а не 6 (Марія, 28.09.2026). Шість карток — це пів екрана
          // на десктопі: людина бачила кнопку «Показати ще» раніше, ніж
          // устигала зрозуміти, що в каталозі взагалі є. Той самий крок
          // лишається й для догортання.
          initialLimit={40}
        />

        {/* Тихий рядок підбірок: найсильніше внутрішнє посилання на
            SEO-сторінки — з головної, але вже після каталогу. */}
        <nav className="v2-topics" aria-label="Підбірки за темами">
          <span className="v2-topics-label">Підбірки:</span>
          {TOPIC_NAV.map((t) => (
            <Link key={t.slug} href={`/${t.slug}`}>{t.label}</Link>
          ))}
        </nav>

        {/* Телефон: «Або оберіть тему» після списку (на десктопі плитки в хіро).
            Порядок «список → канал → теми → організатори» задає CSS
            (home-mobile.css): блоки HomeBlocks на телефоні стають окремими
            дітьми контейнера. */}
        <HomeTopics variant="mobile" />

        <HomeBlocks />
      </main>

      {/* Підказка «Давайте бути на звʼязку». На головній її не було з
          редизайну (#181): найвідвідуваніша сторінка сайту лишалась єдиною,
          де підказка не зʼявлялась узагалі. Повернуто на прохання Марії
          23.09.2026. Тригери й ліміти спільні з рештою сторінок. */}
      <SubscribePopup />

      <Footer />
    </div>
  );
}
