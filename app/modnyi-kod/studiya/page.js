import '@/app/styles/modnyi-kod.css';
import { cookies } from 'next/headers';
import { isAdmin } from '@/lib/adminAuth';
import Link from 'next/link';
import Footer from '../../Footer';
import { MK } from '@/lib/modnyi-kod';
import Studio from '../Studio';

// Онлайн-студія образу «Модного коду» (12.10.2026). З 12.10 студія — частина
// платної участі (Марія: «просто все робимо платною»): відкривається після
// оплати. Поки оплату не відкрито, студію бачить лише адмін; решті — замок і
// посилання на сторінку олімпіади з відео процесу.
const SITE_URL = 'https://dityam.com.ua';
const URL = `${SITE_URL}/${MK.slug}/studiya`;
const TITLE = `Студія образу «${MK.title}» — збери свій лук онлайн`;
const DESCRIPTION = `Безкоштовна онлайн-студія від Dityam.com.ua для юного дизайнера ${MK.ageFrom}–${MK.ageTo} років: збери образ із трендових речей і тканин і подивись його на обкладинці модного журналу.`;

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: true },
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: { title: TITLE, description: DESCRIPTION, url: URL, type: 'website', locale: 'uk_UA', siteName: 'Dityam.com.ua' },
};

export default function StudioPage() {
  const admin = isAdmin(cookies().get('dityam_admin')?.value);
  if (!admin) {
    return (
      <>
        <main className="mk">
          <section className="mk-head mk-locked">
            <p className="mk-kick">{MK.title} · студія юного дизайнера</p>
            <h1>Студія відкривається після <i>оплати участі</i></h1>
            <p className="mk-small">У {MK.price} грн входить усе: студія образу, тест, обкладинка, сертифікат і публікація.</p>
            <Link href={`/${MK.slug}#video`} className="mk-btn-y">Подивитися, як це працює</Link>
          </section>
        </main>
        <Footer />
      </>
    );
  }
  return (
    <>
      <main className="mk">
        <header className="mk-head">
          <p className="mk-kick"><Link href={`/${MK.slug}`}>{MK.title}</Link> · студія юного дизайнера</p>
          <h1>Створи свій <i>образ</i></h1>
        </header>
        <Studio />
      </main>
      <Footer />
    </>
  );
}
