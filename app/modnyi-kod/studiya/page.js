import '@/app/styles/modnyi-kod.css';
import Link from 'next/link';
import Footer from '../../Footer';
import { MK } from '@/lib/modnyi-kod';
import Studio from '../Studio';

// Онлайн-студія образу «Модного коду» — безкоштовна частина (12.10.2026).
// Окрема сторінка, як тест в олімпіади з логіки; опис і умови — на /modnyi-kod.
const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}/${MK.slug}/studiya`;
const TITLE = `Студія образу «${MK.title}» — збери свій лук онлайн`;
const DESCRIPTION = `Безкоштовна онлайн-студія від Dityam.com.ua для юного дизайнера ${MK.ageFrom}–${MK.ageTo} років: збери образ із трендових речей і тканин і подивись його на обкладинці модного журналу.`;

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua' },
};

export default function StudioPage() {
  return (
    <>
      <main className="mk">
        <header className="mk-head">
          <p className="mk-kick"><Link href={`/${MK.slug}`}>{MK.title}</Link> · студія юного дизайнера · безкоштовно</p>
          <h1>Створи свій <i>образ</i></h1>
        </header>
        <Studio />
      </main>
      <Footer />
    </>
  );
}
