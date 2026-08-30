import { notFound } from 'next/navigation';
import OpportunityView, {
  getOpportunity, getRelated, allActiveSlugs, buildMetadata,
} from '../../../o/shared';

// Англійський двійник /o/[slug]: ті самі дані й та сама розмітка, лише
// підписи, адреси й мова інші. Усе спільне — в app/o/shared.js.
export const revalidate = 3600;

export async function generateStaticParams() {
  return allActiveSlugs();
}

export async function generateMetadata({ params }) {
  return buildMetadata(await getOpportunity(params.slug), 'en');
}

export default async function EnglishOpportunityPage({ params }) {
  const item = await getOpportunity(params.slug);
  if (!item) notFound();
  const related = await getRelated(item);
  return <OpportunityView item={item} related={related} lang="en" />;
}
