import Link from 'next/link';
import { CITY_META } from '@/lib/cities';
import { MENTIONS, pressStats } from '@/lib/press';

const SITE_URL = 'https://dityam.com.ua';

export const metadata = {
  title: 'For media — dityam.com.ua press kit',
  description:
    'dityam.com.ua press kit: project figures, a ready-made description, logos and a contact for journalists. A platform of opportunities for Ukrainian children aged 0–18.',
  alternates: {
    canonical: `${SITE_URL}/en/press`,
    languages: { uk: `${SITE_URL}/press`, en: `${SITE_URL}/en/press` },
  },
};

export const revalidate = 3600;

export default async function PressPage() {
  const stats = await pressStats();

  return (
    <div className="container" lang="en">
      <nav className="opportunity-breadcrumbs">
        <Link href="/en">← All opportunities</Link>
      </nav>

      <article className="legal-page">
        <h1>For media</h1>

        <p className="lead">
          Everything you need for a piece about dityam.com.ua: the figures, a
          ready-made description, logos and a contact. The materials are free to
          use, with a link to the site.
        </p>

        {stats ? (
          <>
            <h2>The project in numbers</h2>
            <div className="stats press-stats">
              <div className="stat">
                <span className="stat-num">{stats.total}</span>
                <span className="stat-label">verified opportunities</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.free}</span>
                <span className="stat-label">free of charge</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.sources}</span>
                <span className="stat-label">sources</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.types}</span>
                <span className="stat-label">types of opportunity</span>
              </div>
              <div className="stat">
                <span className="stat-num">{stats.cities}</span>
                <span className="stat-label">cities and regions</span>
              </div>
              <div className="stat">
                <span className="stat-num">0-18</span>
                <span className="stat-label">years old</span>
              </div>
            </div>
            <p className="press-note">
              The figures update automatically — they are current as of the moment
              this page was opened.
            </p>
          </>
        ) : null}

        <h2>Coverage</h2>
        <ul className="press-logos">
          {MENTIONS.map((m) => (
            <li key={m.url}>
              <a href={m.url} target="_blank" rel="noopener noreferrer" title={m.title}>
                <img
                  src={m.logo.src}
                  width={m.logo.width}
                  height={m.logo.height}
                  alt={m.outlet}
                  className={m.logo.width / m.logo.height < 1.5 ? 'is-square' : undefined}
                />
              </a>
            </li>
          ))}
        </ul>

        <h2>Description in one paragraph</h2>
        <blockquote className="press-quote">
          dityam.com.ua is a free platform collecting opportunities for children
          aged 0–18 in Ukraine. Courses, olympiads, scholarships, camps, grants,
          medical help and state payments — in one place, with filters by age,
          region, cost and a child’s particular needs. Every listing is checked by
          hand and links to its official source. Particular attention goes to
          displaced children, children of veterans and of the fallen, and children
          with special needs.
        </blockquote>

        <h2>In brief</h2>
        <ul>
          <li><strong>What it is:</strong> a platform of opportunities for Ukrainian children — in Ukraine and abroad</li>
          <li><strong>Who it is for:</strong> parents, guardians, teachers, social workers</li>
          <li><strong>Ages:</strong> 0–18</li>
          <li><strong>Cost to families:</strong> the platform is free, with no advertising</li>
          <li><strong>Who runs it:</strong> Mary Berezhna, a solo project</li>
          <li><strong>How it is filled:</strong> daily scrapers of the Ministry of Education, the Junior Academy of Sciences, IREX, UNICEF, Erasmus+ and other sources, plus manual review of every listing</li>
          <li>
            <strong>Regional pages:</strong>{' '}
            {Object.entries(CITY_META).map(([slug, meta], i, arr) => (
              <span key={slug}>
                <Link href={`/en/${slug}`}>{meta.en || meta.ua}</Link>
                {i < arr.length - 1 ? ', ' : ''}
              </span>
            ))}
          </li>
        </ul>

        <h2>Full list of publications</h2>
        <ul className="press-mentions">
          {MENTIONS.map((m) => (
            <li key={m.url}>
              <a href={m.url} target="_blank" rel="noopener noreferrer">
                {m.title}
              </a>
              <br />
              <span className="press-mention-meta">
                {m.outlet} · {m.date}
              </span>
            </li>
          ))}
        </ul>

        <h2>Logos and images</h2>
        <ul>
          <li>
            <a href="/press/dityam-brand-kit.zip" download>Brand kit (ZIP, 1.1 MB)</a> —
            the mark and lockups in SVG and PNG, versions for light and dark
            backgrounds, the palette, the DM Sans typeface and usage rules
          </li>
          <li>
            <a href="/icon.svg" download>Icon (SVG)</a> — for favicons and small sizes
          </li>
          <li>
            <a href="/og-image.png" download>Cover 1200×630 (PNG)</a> — for announcements and social media
          </li>
        </ul>
        <p>
          Every opportunity page has its own generated 1200×630 card — sharing a
          link to it is enough.
        </p>

        <h2>Links</h2>
        <ul>
          <li>Site: <a href="https://dityam.com.ua">dityam.com.ua</a></li>
          <li>
            Telegram channel:{' '}
            <a href="https://t.me/dityam_com_ua" target="_blank" rel="noopener noreferrer">
              @dityam_com_ua
            </a>
          </li>
          <li>
            Instagram:{' '}
            <a href="https://www.instagram.com/dityam.com.ua" target="_blank" rel="noopener noreferrer">
              dityam.com.ua
            </a>
          </li>
          <li><Link href="/en/about">About the project</Link></li>
        </ul>

        <h2>Contact for journalists</h2>
        <p>
          Mary Berezhna —{' '}
          <a href="mailto:maryberezhna@gmail.com">maryberezhna@gmail.com</a>. I
          answer requests for comment, statistics and stories of families who found
          a programme through the platform. If you need figures for a particular cut
          — by age, region or type of help — write, and I will prepare them.
        </p>
      </article>
    </div>
  );
}
