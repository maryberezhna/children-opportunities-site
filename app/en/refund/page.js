import Link from 'next/link';

const SITE_URL = 'https://dityam.com.ua';

export const metadata = {
  title: 'Refunds',
  description: 'Terms and procedure for refunds and cancelling a Dityam+ subscription.',
  alternates: {
    canonical: `${SITE_URL}/en/refund`,
    languages: { uk: `${SITE_URL}/refund`, en: `${SITE_URL}/en/refund` },
  },
  robots: { index: true, follow: true },
};

// Дата збігається з українською сторінкою свідомо: це той самий документ,
// і розбіжність у датах читалась би як дві різні редакції умов.
const UPDATED = '20 July 2026';

export default function RefundPage() {
  return (
    <div className="container" lang="en">
      <nav className="opportunity-breadcrumbs">
        <Link href="/en">← All opportunities</Link>
      </nav>
      <article className="legal-page">
        <h1>Refunds</h1>
        <p className="meta-line">Last updated: {UPDATED}</p>

        <h2>1. Cancelling a subscription</h2>
        <p>
          You can cancel your Dityam+ subscription <strong>at any time</strong> with the{' '}
          <code>/stop</code> command in the{' '}
          <a href="https://t.me/DityamPlusBot" target="_blank" rel="noopener noreferrer">@DityamPlusBot</a>{' '}
          bot. After cancelling, <strong>no further recurring charges are made</strong>,
          and access continues until the end of the period already paid for.
        </p>

        <h2>2. Refunds</h2>
        <p>
          The service is digital and is delivered immediately after payment, so the
          fee for the current paid period <strong>is not refundable</strong>. To avoid
          being charged again, cancel with <code>/stop</code> — no further payments
          will be taken.
        </p>
        <ul>
          <li><strong>Incorrect or duplicated transactions</strong> are refunded in
            full, within up to 14 banking days of your request (the actual time
            depends on your issuing bank).</li>
        </ul>

        <h2>3. How to get in touch</h2>
        <p>
          Write to <a href="mailto:mashaberezhna0209@gmail.com">mashaberezhna0209@gmail.com</a>{' '}
          or to the bot, giving the approximate date and amount of the payment. We
          will get back to you and handle the request.
        </p>

        <h2>4. Cancelling a transaction</h2>
        <p>
          Before a charge is actually taken, an unfinished transaction can simply be
          left unconfirmed — no money is withdrawn. If the charge has already gone
          through, the refund procedure described above applies.
        </p>

        <h2>Company details</h2>
        <p>
          Individual entrepreneur Mariia Oleksandrivna Shutiak, tax number (RNOKPP)
          3530900201. The full details are on the{' '}
          <Link href="/en/contacts">Contacts</Link> page and in the{' '}
          <Link href="/en/terms">Public offer</Link>.
        </p>
      </article>
    </div>
  );
}
