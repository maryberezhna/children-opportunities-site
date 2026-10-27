import Link from 'next/link';
import { supabase, publicOpportunities, fetchAllRows, rowsOrThrow, CARD_FIELDS_EN, countActiveOpportunities } from '@/lib/supabase';
import { clientRows } from '@/lib/client-rows';
import { lightCatalog, detailsUrl } from '@/lib/catalog-split';
import { TOPIC_NAV, topicPath } from '@/lib/topics';
import { kyivToday } from '@/lib/dates';
import { visibleFor } from '@/lib/audience';
import { topWeekCards } from '@/lib/weekly-top';
import { isoWeek } from '@/lib/week';
import { daysUntil } from '@/lib/dates';
import HomeTopics from '../HomeTopics';
import OpportunitiesList from '../OpportunitiesList';
import HomeHero from '../HomeHero';
import HomeBlocks from '../HomeBlocks';
import Footer from '../Footer';
import SubscribePopup from '../SubscribePopup';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 300;

// Опис теж рахуємо з бази, як у layout: тут стояло зашите «500+», хоча в
// базі 449 — і саме цей текст показував Google. Округлюємо вниз до
// півсотні, щоб число ніколи не обіцяло більше, ніж є.
export async function generateMetadata() {
  const count = await countActiveOpportunities().catch(() => null);
  const n = count && count >= 50 ? Math.floor(count / 50) * 50 : 400;
  return {
    // absolute: без нього шаблон із app/layout.js дописував українське
    // «| Можливості для дитини» до англійського заголовка — 79 символів і
    // дві мови в одному рядку. І назва повна: не «Dityam», а «Dityam.com.ua».
    title: { absolute: 'Dityam.com.ua — opportunities for Ukrainian children worldwide' },
    description:
      `A free platform with ${n}+ verified opportunities for Ukrainian children aged 0–18 — in Ukraine and abroad: camps, scholarships, olympiads, exchange programs, grants and aid. Updated daily, every link checked nightly.`,
    alternates: {
      canonical: `${SITE_URL}/en`,
      languages: { uk: `${SITE_URL}/`, en: `${SITE_URL}/en` },
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: `${SITE_URL}/en`,
      siteName: 'Dityam.com.ua',
      title: 'Dityam.com.ua — opportunities for Ukrainian children worldwide',
      description:
        'Free platform with verified opportunities for Ukrainian children 0–18, in Ukraine and abroad. Updated daily.',
    },
  };
}

// Той самий набір, що й на українській головній, плюс англійські поля.
async function getOpportunities() {
  if (!supabase) return [];
  return rowsOrThrow(await fetchAllRows(() =>
    publicOpportunities(CARD_FIELDS_EN).order('created_at', { ascending: false }).order('id')), 'en');
}

export default async function EnglishPage() {
  const opportunities = await getOpportunities();
  const today = kyivToday();
  const total = opportunities.length;
  // Головна англійською — того самого вигляду, що українська (Марія, 27.10.2026:
  // «чому дизайни сторінок відрізняються на англ і на укр»): трійка тижня в
  // хіро, фільтри збоку, мобільна верстка. До того /en лишалась у дизайні до
  // редизайну головної, бо мала власну копію сторінки. Олімпіади (OLIMP_TOP)
  // тут немає: сторінки олімпіади англійською немає.
  const week = isoWeek();
  const slim = (o) => ({
    slug: o.slug, title: o.title, title_en: o.title_en || null, deadline: o.deadline || null,
    opportunity_type: o.opportunity_type, age_from: o.age_from, age_to: o.age_to, cost_type: o.cost_type || null,
    href: o.href ? `/en${o.href}` : null, label: o.label || null, perk: o.perk || null,
  });
  const soon = topWeekCards({ items: visibleFor(opportunities, today), week, todayIso: today, daysUntil }).map(slim);
  const teenSoon = topWeekCards({ items: visibleFor(opportunities, today, true), week, todayIso: today, daysUntil }).map(slim);

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Opportunities for Ukrainian children',
    numberOfItems: total,
    itemListElement: opportunities.slice(0, 100).map((o, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE_URL}/en/o/${o.slug}`,
      name: o.title_en || o.title,
    })),
  };

  return (
    <div className="v2-page v2-home" lang="en">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      <HomeHero soon={soon} teenSoon={teenSoon} today={today} lang="en" />

      <main className="v2-container" id="catalog">
        {/* Той самий каталог, що на головній, лише мовою сторінки: назви й
            описи — англійські поля з бази, а доки перекладу для запису немає,
            показуємо оригінал, а не порожнечу. */}
        <OpportunitiesList
          opportunities={lightCatalog(clientRows(opportunities, 'en'), { todayIso: today })}
          detailsUrl={detailsUrl('en')}
          today={today}
          lang="en"
          modeAware
          mobileLayout
          afterAges={<HomeTopics variant="mobile" lang="en" />}
          sidebarLayout
          initialLimit={40}
        />

        <nav className="v2-topics" aria-label="Collections by topic">
          <span className="v2-topics-label">Collections:</span>
          {TOPIC_NAV.map((t) => (
            <Link key={t.slug} href={topicPath(t, 'en')}>
              {t.labelEn || t.label}
            </Link>
          ))}
        </nav>

        {/* Чесно про походження текстів: переклад машинний, і сказати про це
            треба самим, а не чекати, поки людина спіткнеться об дивну фразу. */}
        <p className="en-origin-note">
          Listing texts are translated automatically from the Ukrainian
          originals; the original is always one click away on the Ukrainian
          version of any page. Links lead to the organisers’ own sites, which
          are usually in Ukrainian — your browser translates those in one
          click: right-click the page in Chrome or Edge and choose{' '}
          <i>Translate to English</i>, or press the translate icon in the
          address bar in Safari and Firefox.
        </p>

        <HomeBlocks lang="en" />
      </main>

      {/* Підказка «Давайте бути на звʼязку». На головній її не було з
          редизайну (#181): найвідвідуваніша сторінка сайту лишалась єдиною,
          де підказка не зʼявлялась узагалі. Повернуто на прохання Марії
          23.09.2026. Тригери й ліміти спільні з рештою сторінок. */}
      <SubscribePopup />

      <Footer lang="en" />
    </div>
  );
}
