import { notFound, redirect } from 'next/navigation';
import OpportunityView, {
  getOpportunity, getRelated, allActiveSlugs, buildMetadata, isArchived,
} from '../shared';

// Розмітка, дані й structured data живуть у ../shared.js — той самий вигляд
// потрібен і англійському маршрутові /en/o/[slug], а копія розійшлася б.
export const revalidate = 3600;

export async function generateStaticParams() {
  return allActiveSlugs();
}

export async function generateMetadata({ params }) {
  const item = await getOpportunity(params.slug);
  return buildMetadata(isArchived(item) ? null : item, 'uk');
}

export default async function OpportunityPage({ params }) {
  const item = await getOpportunity(params.slug);
  if (!item) notFound();
  if (isArchived(item)) redirect('/');
  const related = await getRelated(item);
  return <OpportunityView item={item} related={related} lang="uk" />;
}
