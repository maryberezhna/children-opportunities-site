import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { googleCalendarUrl } from '@/lib/calendar-links';
import AddToCalendarFlow from './AddToCalendarFlow';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://dityam.com.ua';

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  if (!supabase) return { title: 'Не знайдено' };
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

  // Статус тут НЕ фільтруємо. Раніше фільтрували — і сторінка починала
  // віддавати 404, щойно можливість закривалась. Посилання на неї живуть
  // у постах каналу й у Google з травня, тож 404 накопичувались: станом на
  // 25.08.2026 їх було 79, і кожне нове закриття додавало ще одне.
  const { data: item } = await supabase
    .from('opportunities')
    .select('slug, title, summary, deadline, status')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!item) notFound();

  // Запис існує, але додавати в календар уже нічого: набір закрито або
  // дедлайну немає. Ведемо на саму можливість — там людина побачить, що
  // сталося, і знайде посилання далі.
  if (item.status !== 'active' || !item.deadline) redirect(`/o/${item.slug}`);

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
