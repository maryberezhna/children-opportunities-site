import '@/app/styles/routes/about.css';
import Link from 'next/link';
import Footer from '../../Footer';
import PressLogos from '../../PressLogos';
import { pressStats } from '@/lib/press';
import { SuggestOpenButton } from '../../SuggestModal';

export const metadata = {
  title: 'About the project — Dityam.com.ua',
  description:
    'Dityam.com.ua is a platform of verified opportunities for Ukrainian children aged 0–18, in Ukraine and abroad. Free for families, no sign-up, no ads. Founded by Mariia Shutiak.',
  alternates: {
    canonical: 'https://dityam.com.ua/en/about',
    languages: {
      uk: 'https://dityam.com.ua/about',
      en: 'https://dityam.com.ua/en/about',
    },
  },
};

export const revalidate = 3600;

const EMAIL = 'hellodityam.com.ua@gmail.com';

const n = (x) => x.toLocaleString('en-US');

export default async function AboutPageEn() {
  const stats = await pressStats();
  const tiles = stats ? [
    [stats.total, stats.total === 1 ? 'opportunity on the platform' : 'opportunities on the platform'],
    [stats.free, 'free for families'],
    [stats.sources, stats.sources === 1 ? 'official source' : 'official sources'],
    [stats.cities, stats.cities === 1 ? 'city or region' : 'cities and regions'],
  ] : [];

  return (
    <div className="v2-page" lang="en">
      <main className="v2-container ab-page">
        <section className="v2-hero pk-hero">
          <div className="v2-hero-copy">
            <div className="v2-hero-status">
              <span className="v2-dot" aria-hidden="true" />
              About the project
            </div>
            <h1>
              Every child should know their <span className="v2-script">options</span>
            </h1>
            <p className="v2-hero-sub">
              Dityam.com.ua is a platform of verified opportunities for Ukrainian
              children aged 0–18. Courses, olympiads, camps, scholarships, clubs,
              medical and psychological help, state payments — in one place,
              checked and updated every day. Free for families, no sign-up, no ads.
            </p>
            <div className="pk-actions">
              <Link href="/en" className="v2-btn-dark">Browse opportunities</Link>
              <a href={`mailto:${EMAIL}`} className="v2-btn-outline">Write to us</a>
            </div>
          </div>
        </section>

        {/* Under the first-screen buttons, as on /about (07.10.2026). */}
        <section className="ab-section" aria-labelledby="ab-press">
          <h2 id="ab-press">In the media</h2>
          <PressLogos />
          <p className="ab-more">
            <Link href="/en/press">All publications and materials for journalists →</Link>
          </p>
        </section>

        {tiles.length ? (
          <section className="ab-section" aria-label="Project figures">
            <div className="pk-stats ab-stats">
              {tiles.map(([num, label]) => (
                <div className="pk-stat" key={label}>
                  <span className="pk-stat-num">{n(num)}</span>
                  <span className="pk-stat-label">{label}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="ab-story" aria-labelledby="ab-why">
          {/* Фото засновниці (Марія, 07.10.2026). Обрізане й без EXIF —
              public/about/mariia-shutiak.{webp,jpg}. Ліворуч на всю висоту, а
              заголовок, текст і підпис — однією колонкою праворуч, по центру. */}
          <picture className="ab-photo">
            <source srcSet="/about/mariia-shutiak.webp" type="image/webp" />
            <img
              src="/about/mariia-shutiak.jpg"
              alt="Mariia Shutiak, founder of Dityam.com.ua, with her child"
              width="720"
              height="900"
              loading="lazy"
              decoding="async"
            />
          </picture>
          <div className="ab-story-text">
            <h2 id="ab-why">Why I do this</h2>
            <p>
              I’m Mariia Shutiak. I believe every Ukrainian child should know what
              is open to them — from a free club in their own town to a scholarship
              abroad.
            </p>
            <p>
              But opportunities are scattered across hundreds of sites and
              channels, written in the language of application forms rather than of
              people, and they reach the families who have time, fast internet and
              the right contacts. So the child who wins isn’t the one who needs it
              most — it’s the one whose parents managed to find it.
            </p>
            <p className="ab-signature">
              {/* Small personal-Instagram icon next to the signature, no label
                  (15.10.2026), same as on /about. */}
              <span className="v2-script">Mariia</span>Shutiak, founder of Dityam.com.ua
              <a className="ab-ig" href="https://www.instagram.com/mary.berezhna/" target="_blank" rel="noopener noreferrer" aria-label="Mariia Shutiak on Instagram">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="17.2" cy="6.8" r="1.3" fill="currentColor" stroke="none" />
                </svg>
              </a>
            </p>
          </div>
        </section>

        <section className="ab-section" aria-labelledby="ab-mission">
          <h2 id="ab-mission">What we do for families</h2>
          <p className="ab-intro">
            Our mission is to make a child’s access to development independent of
            their city, their family’s means, and whether their parents know how to
            search. Finding an opportunity is only the first step, and we go
            further with the family.
          </p>
          <ol className="ab-cards">
            <li className="ab-card">
              <span className="ab-card-n">01</span>
              <h3>Show what exists</h3>
              <p>One place instead of a hundred sources — with filters by age, city, cost and deadline.</p>
            </li>
            <li className="ab-card">
              <span className="ab-card-n">02</span>
              <h3>Help choose the right one</h3>
              <p>Not a list of hundreds of cards, but what suits this particular child — their age, interests and family situation.</p>
            </li>
            <li className="ab-card">
              <span className="ab-card-n">03</span>
              <h3>Make sure nothing is missed</h3>
              <p>Deadlines pass quietly. We remind you early, while there is still time to apply.</p>
            </li>
            <li className="ab-card">
              <span className="ab-card-n">04</span>
              <h3>Support what comes after</h3>
              <p>A child’s development isn’t a single class. Parents need ground under their feet too: how to choose, and how to talk about it with their child.</p>
            </li>
          </ol>
        </section>

        <section className="ab-section ab-focus" aria-labelledby="ab-focus">
          <h2 id="ab-focus">Special attention to the families who have it hardest</h2>
          <p className="ab-intro">
            For displaced children, children of Ukraine’s defenders, children with
            disabilities, children with cancer and orphans, the state and
            foundations run separate programmes — but you have to look for them in
            the same places as everyone else. Here it’s a filter of its own, and
            children of defenders have a dedicated{' '}
            <Link href="/en/children-of-veterans">collection</Link>.
          </p>
        </section>

        <section className="ab-section" aria-labelledby="ab-checks">
          <h2 id="ab-checks">How we check programmes</h2>
          <ul className="ab-checks">
            <li>Every opportunity links to an official source</li>
            <li>We check every day that links are alive: dead three days in a row — the listing is closed</li>
            <li>When a deadline passes, the listing leaves the lists, and its page stays marked as ended</li>
            <li>Opportunities without a deadline are re-read regularly — is the intake still open?</li>
            <li>Paid programmes are marked as paid, and free ones can be filtered separately</li>
          </ul>
          <p className="ab-more"><Link href="/en/how-we-verify">How we verify, in detail →</Link></p>
        </section>

        <section className="v2-bottom">
          <div className="v2-panel">
            <h2>Take part</h2>
            <p>
              Know a programme that isn’t here? Spotted a mistake? Write to us —
              we will check and fix it.
            </p>
            <div className="v2-panel-actions">
              {/* Та сама форма, що у футері (Марія, 07.10.2026: «чому тут нема такої самої форми»). */}
              <SuggestOpenButton className="v2-btn-dark">Suggest an opportunity</SuggestOpenButton>
              <a href={`mailto:${EMAIL}`} className="v2-btn-outline">{EMAIL}</a>
              <a href="https://www.instagram.com/dityam.com.ua" target="_blank" rel="noopener noreferrer" className="v2-btn-outline">Instagram</a>
            </div>
          </div>
          <div className="v2-panel">
            <h2>Support</h2>
            <p>
              The platform is free for families, for good. What helps it
              grow is the Dityam+ subscription, and a
              donation pays for new sources, the domain and hosting.
            </p>
            <div className="v2-panel-actions">
              <Link href="/en/plus" className="v2-btn-dark">Dityam+</Link>
              <a href="https://send.monobank.ua/jar/F72fDrV2c" target="_blank" rel="noopener noreferrer" className="v2-btn-outline">Donate on monobank</a>
            </div>
          </div>
        </section>

        <p className="ab-partners">
          The site was built with technical support from{' '}
          <a href="https://dot-hub.club/" target="_blank" rel="noopener noreferrer">.HUB</a>{' '}
          (HubSpot Partner).
        </p>
      </main>
      <Footer lang="en" />
    </div>
  );
}
