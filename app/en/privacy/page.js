import Link from 'next/link';
import Footer from '../../Footer';

export const metadata = {
  title: 'Privacy Policy — Dityam',
  description:
    'How dityam.com.ua handles your data: analytics, the newsletter, cookies and your rights.',
  alternates: {
    canonical: 'https://dityam.com.ua/en/privacy',
    languages: {
      uk: 'https://dityam.com.ua/privacy',
      en: 'https://dityam.com.ua/en/privacy',
    },
  },
  robots: { index: true, follow: true },
};

const UPDATED = '3 May 2026';

export default function PrivacyPageEn() {
  return (
    <div className="container" lang="en">
      <nav className="opportunity-breadcrumbs">
        <Link href="/en">← All opportunities</Link>
      </nav>
      <article className="legal-page">
        <h1>Privacy Policy</h1>
        <p className="meta-line">Last updated: {UPDATED}</p>

        {/* Юридично чинний — український текст: документ складено за
            українським правом і саме він подається на вимогу. Англійська
            версія існує, щоб людину не змушували читати незрозуміле, і про
            її статус треба сказати першим рядком, а не дрібним шрифтом. */}
        <p className="legal-note">
          This is a translation for convenience. The{' '}
          <Link href="/privacy">Ukrainian version</Link> is the legally binding
          one; if the two ever differ, the Ukrainian text prevails.
        </p>

        <h2>1. Who we are</h2>
        <p>
          The site dityam.com.ua (the “Site”) is a non-commercial platform of
          opportunities for Ukrainian children. Owner and administrator —
          Mariia Berezhna, contact:{' '}
          <a href="mailto:maryberezhna@gmail.com">maryberezhna@gmail.com</a>.
        </p>

        <h2>2. What data we collect</h2>
        <ul>
          <li>
            <strong>Analytics (Google Analytics 4, Hotjar):</strong> anonymised
            IP address, device type, browser, language, path through the site,
            session length, click events. Used to improve the site.
          </li>
          <li>
            <strong>Newsletter:</strong> if you fill in the subscription form,
            we store your email address in HubSpot in order to send updates.
            You can unsubscribe at any time via the link in any email.
          </li>
          <li>
            <strong>Emails to us:</strong> if you write to us, your email
            address and the content of your message are kept in our mailbox.
          </li>
        </ul>

        <h2>3. Cookies</h2>
        <p>
          We use technical cookies (to run the site) and analytics cookies
          (Google Analytics, Hotjar). You can block them in your browser
          settings — the listings will still work.
        </p>

        <h2>4. Sharing with third parties</h2>
        <ul>
          <li>
            Google (Analytics) — processing under{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google’s Privacy Policy</a>.
          </li>
          <li>
            Hotjar — processing under{' '}
            <a href="https://www.hotjar.com/legal/policies/privacy/" target="_blank" rel="noopener noreferrer">Hotjar’s Privacy Policy</a>.
          </li>
          <li>
            HubSpot (newsletter) — processing under{' '}
            <a href="https://legal.hubspot.com/privacy-policy" target="_blank" rel="noopener noreferrer">HubSpot’s Privacy Policy</a>.
          </li>
          <li>
            Vercel (hosting) — processing under{' '}
            <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel’s Privacy Policy</a>.
          </li>
          <li>
            Supabase (database) — processing under{' '}
            <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">Supabase’s Privacy Policy</a>.
          </li>
        </ul>
        <p>We do not sell or pass your data to advertising networks.</p>

        <h2>5. Your rights</h2>
        <p>
          Under Ukrainian personal data protection law and the GDPR (for users
          in the EU) you have the right to:
        </p>
        <ul>
          <li>access the data we hold about you;</li>
          <li>request correction or deletion of that data;</li>
          <li>withdraw your consent to processing at any time;</li>
          <li>lodge a complaint with the Ukrainian Parliament Commissioner for Human Rights.</li>
        </ul>
        <p>
          To exercise these rights, write to{' '}
          <a href="mailto:maryberezhna@gmail.com">maryberezhna@gmail.com</a>.
        </p>

        <h2>6. Changes to this policy</h2>
        <p>
          We may update this policy. The date of the last update is shown at the
          top of this page.
        </p>
      </article>
      <Footer lang="en" />
    </div>
  );
}
