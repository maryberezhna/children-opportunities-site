import Link from 'next/link';

const SITE_URL = 'https://dityam.com.ua';

export const metadata = {
  title: 'Cancellation and refunds',
  description: 'How to cancel a Dityam+ subscription and when money is returned: paid periods are not refunded; mistaken or duplicated charges are.',
  alternates: {
    canonical: `${SITE_URL}/en/refund`,
    languages: { uk: `${SITE_URL}/refund`, en: `${SITE_URL}/en/refund` },
  },
  robots: { index: true, follow: true },
};

// Дата збігається з українською сторінкою свідомо: це той самий документ,
// і розбіжність у датах читалась би як дві різні редакції умов.
const UPDATED = '14 September 2026';

export default function RefundPage() {
  return (
    <div className="container" lang="en">
      <nav className="opportunity-breadcrumbs">
        <Link href="/en">← All opportunities</Link>
      </nav>
      <article className="legal-page">
        <h1>Cancellation and refunds</h1>
        <p className="meta-line">Last updated: {UPDATED}</p>

        <p className="legal-note">
          This is a translation for convenience. The{' '}
          <Link href="/refund">Ukrainian version</Link> is the legally binding
          one; if the two ever differ, the Ukrainian text prevails.
        </p>

        <h2>1. Cancelling a subscription</h2>
        <p>
          You can cancel your Dityam+ subscription <strong>at any time</strong> with the{' '}
          <code>/stop</code> command in the{' '}
          <a href="https://t.me/DityamPlusBot" target="_blank" rel="noopener noreferrer">@DityamPlusBot</a>{' '}
          bot. The bot stops the recurring payment first and then the subscription,
          so <strong>there is no next charge</strong>.
        </p>

        <h2>2. Refunds</h2>
        <p>
          The service is digital and is delivered immediately after payment, so{' '}
          <strong>fees for a paid period are not refunded</strong> — for either the
          monthly or the annual plan, including after cancellation.
        </p>
        <p>
          The exception is <strong>mistaken or duplicated charges</strong>: these are
          refunded in full within up to 14 banking days of your request (the actual
          time depends on the bank that issued your card).
        </p>

        <h2>3. Reporting a mistaken charge</h2>
        <p>
          Write to <a href="mailto:hellodityam.com.ua@gmail.com">hellodityam.com.ua@gmail.com</a>{' '}
          or to the bot, giving the approximate date and amount of the payment.
        </p>

        <h2>4. Unfinished payments</h2>
        <p>
          No money is taken until a payment is confirmed — an unfinished transaction
          can simply be left unconfirmed.
        </p>

        <h2>Seller details</h2>
        <p>
          Individual entrepreneur Mariia Oleksandrivna Shutiak, tax number (RNOKPP)
          3530900201. Full details are in the <Link href="/en/terms">Public offer</Link>.
        </p>
      </article>
    </div>
  );
}
