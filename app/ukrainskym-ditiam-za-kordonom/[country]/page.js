import { notFound } from 'next/navigation';
import { diasporaCountryBySlug, qualifyingCountryTopics } from '@/lib/topics';
import { kyivToday } from '@/lib/dates';
import { isLive } from '@/lib/audience';
import TopicPage, { topicMetadata, topicRows } from '../../TopicPage';

/**
 * «Українським дітям у Польщі» й інші сторінки країн (lib/topics.js,
 * DIASPORA_COUNTRY_TOPICS). Як «місто × підбірка»: у білд ідуть лише країни
 * над порогом, решта віддає 404 (поріг перевіряє сам TopicPage). dynamicParams
 * лишається увімкненим — країна, що доросла до порогу, зʼявляється на першому
 * ж запиті без деплою.
 */
export const revalidate = 300;

export async function generateStaticParams() {
  const today = kyivToday();
  const live = (await topicRows('uk', 'diaspora-countries')).filter((o) => isLive(o, today));
  return qualifyingCountryTopics(live).map((t) => ({ country: t.slug.split('/').pop() }));
}

export function generateMetadata({ params }) {
  const topic = diasporaCountryBySlug(params.country);
  return topic ? topicMetadata(topic) : {};
}

export default function Page({ params }) {
  const topic = diasporaCountryBySlug(params.country);
  if (!topic) notFound();
  return <TopicPage topic={topic} />;
}
