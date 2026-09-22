import { notFound, redirect } from 'next/navigation';
import OpportunityView, {
  getOpportunity, getRelated, buildMetadata, isArchived,
} from '../../../o/shared';

// Англійський двійник /o/[slug]: ті самі дані й та сама розмітка, лише
// підписи, адреси й мова інші. Усе спільне — в app/o/shared.js.
export const revalidate = 3600;

// Картки збираються при першому відкритті й далі живуть у кеші ті самі 3600
// секунд — так само, як українські (див. app/o/[slug]/page.js). Google індексує
// так само, лише перший його візит на кожну адресу трохи повільніший.
//
// Порожній список тут обовʼязковий. До 22.09.2026 generateStaticParams не було
// зовсім, і Next 14 вважав маршрут динамічним («ƒ» у таблиці збірки): кожен
// відвідувач і бот отримував x-vercel-cache: MISS, тобто новий рендер і два-три
// запити в базу. Збірку це вкоротило, але кеш на картках пропав.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const item = await getOpportunity(params.slug);
  return buildMetadata(isArchived(item) ? null : item, 'en');
}

export default async function EnglishOpportunityPage({ params }) {
  const item = await getOpportunity(params.slug);
  if (!item) notFound();
  if (isArchived(item)) redirect('/en');
  const related = await getRelated(item);
  return <OpportunityView item={item} related={related} lang="en" />;
}
