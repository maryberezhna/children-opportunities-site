import Link from 'next/link';
import Footer from '../../Footer';

export const metadata = {
  title: 'About the project — how dityam.com.ua started',
  description:
    'A platform of verified opportunities for Ukrainian children aged 0–18, in Ukraine and abroad. Free, ad-free, built by one person.',
  alternates: {
    canonical: 'https://dityam.com.ua/en/about',
    languages: {
      uk: 'https://dityam.com.ua/about',
      en: 'https://dityam.com.ua/en/about',
    },
  },
};

export default function AboutPageEn() {
  return (
    <div className="container" lang="en">
      <nav className="opportunity-breadcrumbs">
        <Link href="/en">← All opportunities</Link>
      </nav>
      <article className="legal-page">
        <h1>About the project</h1>

        <p className="lead">
          dityam.com.ua is a platform of verified opportunities for Ukrainian
          children aged 0–18. Courses, olympiads, camps, scholarships, clubs,
          medical and psychological help, state payments — gathered in one
          place, checked by hand and updated every day. Free for families, no
          sign-up, no ads.
        </p>

        <h2>Why us</h2>
        <p>
          I’m Masha Berezhna. I believe every Ukrainian child should know what
          is open to them — from a free club in their own town to a scholarship
          abroad. But opportunities are scattered across hundreds of sites and
          channels, written in the language of application forms rather than of
          people, and they reach the families who have time, fast internet and
          the right contacts. So the child who wins isn’t the one who needs it
          most — it’s the one whose parents managed to find it.
        </p>

        <h2>Our mission</h2>
        <p>
          To make a child’s access to development independent of their city,
          their family’s means, and whether their parents know how to search.
          Finding an opportunity is only the first step, and we go further with
          the family:
        </p>
        <ul>
          <li>
            <strong>Show what exists at all.</strong> One place instead of a
            hundred sources — with filters by age, city, cost and deadline.
          </li>
          <li>
            <strong>Help choose the right one.</strong> Not a list of four
            hundred cards, but what suits this particular child — their age,
            their interests and their family’s situation.
          </li>
          <li>
            <strong>Make sure nothing is missed.</strong> Deadlines pass
            quietly. We remind you early, while there is still time to apply.
          </li>
          <li>
            <strong>Support what comes after.</strong> A child’s development
            isn’t a single class. Parents need ground under their feet too:
            how to choose, and how to talk about it with their child.
          </li>
        </ul>
        <p>
          We pay separate attention to the families who have it hardest:
          displaced children, children of veterans and of the fallen, children
          with disabilities, children with cancer, orphans. The state and
          foundations run separate programmes for them — but you have to look
          for those in the same places as everyone else. Here it’s a filter of
          its own.
        </p>

        <h2>How we check programmes</h2>
        <ul>
          <li>Every opportunity has an official source link</li>
          <li>We check every day that the links are alive</li>
          <li>Opportunities without a deadline are re-read every 45 days — is the intake still open?</li>
          <li>We only add free or affordable programmes</li>
          <li>One-off events that have passed are hidden automatically</li>
        </ul>

        <h2>How to take part</h2>
        <p>
          Know a programme that isn’t here? Spotted a mistake?
          {' '}<a href="mailto:maryberezhna@gmail.com">Write to us</a>{' '}
          or{' '}
          <a href="https://www.instagram.com/dityam.com.ua" target="_blank" rel="noopener noreferrer">
            on Instagram
          </a>.
        </p>

        <h2>Support</h2>
        <p>
          The platform is free for families and ad-free, for good. The project
          is independent: what helps it grow is the{' '}
          <Link href="/pidbirka">Dityam+</Link> subscription — a personal
          selection of opportunities for your child (the waiting list is open
          now). And if you simply want to help, a donation on{' '}
          <a href="https://send.monobank.ua/jar/F72fDrV2c" target="_blank" rel="noopener noreferrer">monobank</a>{' '}
          pays for new sources, the domain and hosting.
        </p>

        <h2>Partners</h2>
        <p>
          The site was built with technical support from{' '}
          <a href="https://dot-hub.club/" target="_blank" rel="noopener noreferrer">.HUB</a>{' '}
          (HubSpot Partner).
        </p>
      </article>
      <Footer lang="en" />
    </div>
  );
}
