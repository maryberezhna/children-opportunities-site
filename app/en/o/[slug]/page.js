import { notFound, redirect } from 'next/navigation';
import OpportunityView, {
  getOpportunity, getRelated, buildMetadata, isArchived, archivedRedirectPath,
} from '../../../o/shared';

// Англійський двійник /o/[slug]: ті самі дані й та сама розмітка, лише
// підписи, адреси й мова інші. Усе спільне — в app/o/shared.js.
// 300, а не 3600: виправлення в базі має з'являтись на сторінці за хвилини.
// Разом із HTML оновлюється і Data Cache запиту до Supabase — він успадковує
// revalidate сегмента й саме через нього 19.10.2026 сторінка цілу годину
// показувала стару назву організатора, хоч у базі вже була нова. Менше ставити
// не варто: кожна генерація — запит у базу, а карток понад шістсот.
export const revalidate = 300;

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
  if (isArchived(item)) redirect(archivedRedirectPath(item, 'en'));
  const related = await getRelated(item);
  return <OpportunityView item={item} related={related} lang="en" />;
}
