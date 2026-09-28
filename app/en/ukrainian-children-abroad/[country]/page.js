import { notFound } from 'next/navigation';
import { diasporaCountryBySlug, qualifyingCountryTopics } from '@/lib/topics';
import { kyivToday } from '@/lib/dates';
import { isLive } from '@/lib/audience';
import TopicPage, { topicMetadata, topicRows } from '../../../TopicPage';

/** Англійські двійники сторінок країн діаспори: ті самі правила й поріг. */
export const revalidate = 300;

export async function generateStaticParams() {
  const today = kyivToday();
  const live = (await topicRows('en', 'diaspora-countries')).filter((o) => isLive(o, today));
  return qualifyingCountryTopics(live).map((t) => ({ country: t.en.slug.split('/').pop() }));
}

export function generateMetadata({ params }) {
  const topic = diasporaCountryBySlug(params.country, 'en');
  return topic ? topicMetadata(topic, 'en') : {};
}

export default function Page({ params }) {
  const topic = diasporaCountryBySlug(params.country, 'en');
  if (!topic) notFound();
  return <TopicPage topic={topic} lang="en" />;
}
