// Сторінка існує тільки для Dityam+: посилання на неї ставить бот під
// можливістю в персональній добірці (scraper/personal_digest.py). З відкритого
// каталогу кнопки «Додати в календар» немає — 16.09.2026 її прибрали звідти
// й з постів каналу: додавання дедлайну в календар належить підписці.
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { calendarTarget, googleCalendarUrl } from '@/lib/calendar-links';
import { kyivToday } from '@/lib/dates';
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
    .select('slug, title, summary, deadline, event_start_date, event_end_date, status')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!item) notFound();

  // Запис існує, але додавати в календар уже нічого: набір закрито або
  // дедлайну немає. Ведемо на саму можливість — там людина побачить, що
  // сталося, і знайде посилання далі.
  // Дедлайн, поки він попереду, інакше — дати самої події (lib/calendar-links).
  const target = item.status === 'active' ? calendarTarget(item, kyivToday()) : null;
  if (!target) redirect(`/o/${item.slug}`);

  const googleUrl = googleCalendarUrl({
    title: item.title,
    description: item.summary,
    date: target.start,
    endDate: target.kind === 'event' ? target.end : undefined,
    url: `${SITE_URL}/o/${item.slug}`,
  });

  const icsApiUrl = `${SITE_URL}/api/events/${item.slug}/ics`;
  const webcalUrl = icsApiUrl.replace(/^https?:\/\//, 'webcal://');

  const fmt = (iso) => new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Kyiv',
  });
  const whenText = target.kind === 'deadline'
    ? `Заявки до: ${fmt(target.start)}`
    : `Коли: ${target.start === target.end ? fmt(target.start) : `${fmt(target.start)} — ${fmt(target.end)}`}`;

  return (
    <div className="container">
      <nav className="opportunity-breadcrumbs">
        <Link href={`/o/${item.slug}`}>← {item.title}</Link>
      </nav>

      <div className="cal-add-wrap">
        <p className="cal-add-event-name">{item.title}</p>
        <p className="cal-add-deadline">{whenText}</p>

        <AddToCalendarFlow
          googleUrl={googleUrl}
          webcalUrl={webcalUrl}
        />

        <p className="cal-add-note">
          {target.kind === 'deadline'
            ? 'Нагадування прийде за день до дедлайну.'
            : 'Нагадування прийде за день до початку.'}
        </p>
      </div>
    </div>
  );
}
