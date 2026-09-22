import { notFound, redirect } from 'next/navigation';
import OpportunityView, {
  getOpportunity, getRelated, buildMetadata, isArchived,
} from '../shared';

// Розмітка, дані й structured data живуть у ../shared.js — той самий вигляд
// потрібен і англійському маршрутові /en/o/[slug], а копія розійшлася б.
export const revalidate = 3600;

// Картки збираються при першому відкритті, а не на білді, і далі живуть у
// кеші ті самі 3600 секунд.
//
// Лог продакшн-збірки 22.09.2026: із 322 секунд 288 ішло на «Generating
// static pages», і 1 000 із 1 090 тих сторінок — саме ці картки (рівно тисяча,
// бо список слагів упирався в ліміт вибірки бази, решта й так збиралась на
// запит). Перший відвідувач картки поза кешем чекає стільки ж, скільки на
// передзібраній: заміряли 0,3–0,45 с проти 0,47 с.
//
// Порожній список — не те саме, що без generateStaticParams зовсім: без нього
// Next 14 вважає маршрут динамічним і рендерить кожен запит наново, без кешу
// (так було з /en/o/[slug] — у кожного відвідувача x-vercel-cache: MISS).
export async function generateStaticParams() {
  return [];
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
