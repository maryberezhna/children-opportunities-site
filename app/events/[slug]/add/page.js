import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { googleCalendarUrl } from '@/lib/calendar-links';
import AddToCalendarFlow from './AddToCalendarFlow';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dityam.com.ua';

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const { data: item } = await supabase
    .from('opportunities')
    .select('title, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!item) return { title: 'Не знайдено' };
  return {
    title: `Додати в календар — ${item.title}`,
    robots: { index: false },
  };
}

export default async function AddToCalendarPage({ params }) {
  if (!supabase) notFound();

  const { data: item } = await supabase
    .from('opportunities')
    .select('slug, title, summary, deadline')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!item || !item.deadline) notFound();

  const googleUrl = googleCalendarUrl({
    title: item.title,
    description: item.summary,
    date: item.deadline,
    url: `${SITE_URL}/o/${item.slug}`,
  });

  const icsApiUrl = `${SITE_URL}/api/events/${item.slug}/ics`;
  const webcalUrl = icsApiUrl.replace(/^https?:\/\//, 'webcal://');

  const deadlineFormatted = new Date(item.deadline).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  });

  return (
    <div className="container">
      <nav className="opportunity-breadcrumbs">
        <Link href={`/o/${item.slug}`}>← {item.title}</Link>
      </nav>

      <div className="cal-add-wrap">
        <p className="cal-add-event-name">{item.title}</p>
        <p className="cal-add-deadline">Дедлайн: {deadlineFormatted}</p>

        <AddToCalendarFlow
          googleUrl={googleUrl}
          webcalUrl={webcalUrl}
        />

        <p className="cal-add-note">
          Нагадування прийде за день до дедлайну.
        </p>
      </div>
    </div>
  );
}
