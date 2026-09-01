import { notFound } from 'next/navigation';
import OpportunityView, {
  getOpportunity, getRelated, buildMetadata,
} from '../../../o/shared';

// Англійський двійник /o/[slug]: ті самі дані й та сама розмітка, лише
// підписи, адреси й мова інші. Усе спільне — в app/o/shared.js.
export const revalidate = 3600;

// generateStaticParams тут свідомо НЕМАЄ.
//
// Українських карток тисяча, англійських стільки ж — і разом це 2000 із 2062
// сторінок усієї збірки, кожна з двома-трьома запитами в базу. Збірка виросла
// до чверті години рівно тоді, коли зʼявився цей маршрут, і половину того часу
// займає саме він.
//
// Без списку слагів сторінка збирається при першому відкритті й далі живе в
// кеші ті самі 3600 секунд. Google індексує так само — просто перший його
// візит на кожну адресу трохи повільніший. Англійського трафіку часточка від
// українського, тож ціна майже нульова, а збірка стає вдвічі коротшою.
//
// Українські картки лишаються передзібраними: це основний трафік і головна
// пошукова поверхня, там чекання на першому візиті коштувало б дорожче.

export async function generateMetadata({ params }) {
  return buildMetadata(await getOpportunity(params.slug), 'en');
}

export default async function EnglishOpportunityPage({ params }) {
  const item = await getOpportunity(params.slug);
  if (!item) notFound();
  const related = await getRelated(item);
  return <OpportunityView item={item} related={related} lang="en" />;
}
