import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { googleCalendarUrl } from '@/lib/calendar-links';
import AddToCalendarFlow from '../../../../events/[slug]/add/AddToCalendarFlow';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dityam.com.ua';

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  if (!supabase) return { title: 'Not found' };
  const { data: item } = await supabase
    .from('opportunities')
    .select('title, title_en, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!item) return { title: 'Not found' };
  return {
    title: `Add to calendar — ${item.title_en || item.title}`,
    robots: { index: false },
  };
}

export default async function AddToCalendarPage({ params }) {
  if (!supabase) notFound();

  // Статус тут НЕ фільтруємо — з тієї ж причини, що й на українській версії:
  // посилання живуть у постах каналу, і 404 після закриття набору лише
  // накопичувались би.
  const { data: item } = await supabase
    .from('opportunities')
    .select('slug, title, title_en, summary, summary_en, deadline, status')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!item) notFound();

  if (item.status !== 'active' || !item.deadline) redirect(`/en/o/${item.slug}`);

  const name = item.title_en || item.title;

  // У сам календар кладемо англійські назву й опис, а посилання веде на
  // англійську сторінку: подія осідає в календарі надовго, і мова там має
  // збігатися з тією, якою людина її додавала.
  const googleUrl = googleCalendarUrl({
    title: name,
    description: item.summary_en || item.summary,
    date: item.deadline,
    url: `${SITE_URL}/en/o/${item.slug}`,
  });

  const icsApiUrl = `${SITE_URL}/api/events/${item.slug}/ics`;
  const webcalUrl = icsApiUrl.replace(/^https?:\/\//, 'webcal://');

  const deadlineFormatted = new Date(item.deadline).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  });

  return (
    <div className="container" lang="en">
      <nav className="opportunity-breadcrumbs">
        <Link href={`/en/o/${item.slug}`}>← {name}</Link>
      </nav>

      <div className="cal-add-wrap">
        <p className="cal-add-event-name">{name}</p>
        <p className="cal-add-deadline">Deadline: {deadlineFormatted}</p>

        <AddToCalendarFlow
          googleUrl={googleUrl}
          webcalUrl={webcalUrl}
        />

        <p className="cal-add-note">
          A reminder arrives the day before the deadline.
        </p>
      </div>
    </div>
  );
}
