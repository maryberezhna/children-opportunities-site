import Link from 'next/link';
import Footer from '../../Footer';
import { PLUS_FREE } from '@/lib/plus';

export const metadata = {
  title: 'Public offer and terms — Dityam',
  description:
    'Terms of the paid Dityam+ subscription: subject, prices, payment, delivery of the service, cancellation and seller details.',
  alternates: {
    canonical: 'https://dityam.com.ua/en/terms',
    languages: {
      uk: 'https://dityam.com.ua/terms',
      en: 'https://dityam.com.ua/en/terms',
    },
  },
  robots: { index: true, follow: true },
};

const UPDATED = '20 October 2026';

export default function TermsPageEn() {
  return (
    <>
      <div className="container" lang="en">
        <nav className="opportunity-breadcrumbs">
          <Link href="/en">← All opportunities</Link>
        </nav>
        <article className="legal-page">
          <h1>Public offer and terms of use</h1>
          <p className="meta-line">Last updated: {UPDATED}</p>

          <p className="legal-note">
            This is a translation for convenience. The{' '}
            <Link href="/terms">Ukrainian version</Link> is the legally binding
            one; if the two ever differ, the Ukrainian text prevails.
          </p>

          <h2>1. General provisions</h2>
          <p>
            This document is a public offer by the Seller to enter into a contract
            for the provision of the “Dityam+” information service on the terms
            set out below. Taking out a subscription means full and unconditional
            acceptance of these terms.
          </p>
          <p>
            <strong>Seller:</strong> individual entrepreneur Mariia Oleksandrivna
            Shutiak, taxpayer number (RNOKPP) 3530900201. Contacts and details are
            in section 9.
          </p>

          <h2>2. Subject of the service</h2>
          <p>
            “Dityam+” is a paid information subscription under which the user
            receives:
          </p>
          <ul>
            <li>
              personal notifications about opportunities for their child
              (competitions, programmes, scholarships, camps and so on), selected
              separately for each child by the age, interests, format and location
              provided — at the frequency chosen in the bot;
            </li>
            <li>reminders about application deadlines;</li>
            <li>information support with submitting applications;</li>
            <li>entry into partner prize draws.</li>
          </ul>
          <p>
            The service is digital and delivered through the Telegram bot{' '}
            <a href="https://t.me/DityamPlusBot" target="_blank" rel="noopener noreferrer">@DityamPlusBot</a>.
            All opportunities on the dityam.com.ua platform remain free and fully
            open to everyone. What the Dityam+ subscription buys is a service:
            selecting opportunities that fit a child’s profile, reminding about
            deadlines, and helping with the application.
          </p>

          <h2>3. Price</h2>
          {PLUS_FREE ? (
            <>
              <p>
                <strong>The Dityam+ subscription is provided free of charge.</strong> No fee is
                taken, no payment details are collected and no recurring charges are created.
              </p>
              <p>
                If money is nevertheless charged on a subscription set up earlier, we refund it
                in full, without the user having to ask.
              </p>
            </>
          ) : (
            <>
          <ul>
            <li><strong>Monthly subscription — UAH 99</strong> (charged every month).</li>
            <li><strong>Six-month subscription — UAH 549</strong> (charged every six months, ≈ UAH 92/month).</li>
            <li><strong>First month of the monthly subscription — UAH 1</strong> for participants of the
              Dityam.com.ua online olympiad and for anyone who started signing up in the bot before
              13 October 2026, if they have not paid for the subscription before. One month after the first payment, and every
              month after that, the full price of UAH 99 is charged. You can cancel any time
              before the charge with the /stop command in the bot.</li>
            <li><strong>With a promo code</strong> — the discount applies to the FIRST payment
              only; every payment after that is the full price. The code is entered in the
              Telegram bot before paying, and the price on the button updates before you reach
              the payment page. The current code, “FIRST”: the first month is UAH 1 instead of
              99 (the payment service cannot process a UAH 0 payment), the first six months UAH 439
              instead of 549. It applies to a person who has not paid for the subscription before.</li>
          </ul>
          <p>
            Payment is made online through the WayForPay payment service.
            Available methods: Visa / Mastercard bank cards, Apple Pay, Google
            Pay, in-messenger payment (BotPay). Prices are in Ukrainian hryvnia
            (UAH) and include all taxes.
          </p>
          <p>
            By subscribing, the user agrees to <strong>regular automatic
            charging</strong> of the chosen amount at the interval of the chosen
            plan, until the subscription is cancelled.
          </p>
            </>
          )}

          <h2>4. How and when the service is provided</h2>
          <p>
            Access is granted <strong>{PLUS_FREE ? 'as soon as the child’s profile is filled in in the bot' : 'immediately after successful payment'}</strong>:
            the user receives notifications based
            on the child’s profile filled in in the bot. Notifications are sent at
            the frequency the user chooses in the bot: daily, every 2 days or once a week
            (new opportunities are checked daily). The service is provided
            remotely; there is no physical delivery.
          </p>

          <h2>5. Term, cancellation and refunds</h2>
          <p>
            The subscription runs indefinitely until the user cancels it. You can
            cancel <strong>at any time</strong> with the <code>/stop</code> command
            in the bot — further charges then stop.
          </p>
          <p>
            <strong>Fees for a paid period are not refunded</strong>, including
            after cancellation. The exception is mistaken or duplicated charges,
            which are refunded in full. The procedure is on the{' '}
            <Link href="/en/refund">Cancellation and refunds</Link> page.
          </p>
          <p>
            The same applies when access, an account, participation in a contest
            or a diploma is revoked for breaking these Terms or the rules of a
            contest (section 6): fees paid are not refunded, including entry fees
            and payment for a printed diploma. The service counts as provided from
            the moment access to it is opened.
          </p>

          <h2>6. Rights and obligations</h2>
          <ul>
            <li>
              The Seller undertakes to provide the service as described and to
              keep data confidential in line with the{' '}
              <Link href="/en/privacy">Privacy Policy</Link>.
            </li>
            <li>
              The user undertakes to provide accurate details for setting up the
              subscription and to pay for the service on time.
            </li>
            {/* Right to revoke access and diplomas (16.10.2026) — mirrors /terms. */}
            <li>
              The user undertakes to use the platform in good faith: to complete
              contest and olympiad tasks independently, not to demand diplomas,
              prizes or payment without meeting the conditions, and not to abuse
              other users or the team.
            </li>
            <li>
              Contest and olympiad tasks belong to the Seller. Photographing them,
              taking screenshots or screen recordings, copying, publishing or
              passing them to others is not allowed: every participant gets the
              same tasks, so a leaked screenshot spoils the contest for other
              children.
            </li>
            <li>
              The Seller may suspend or revoke access to the service, an account,
              participation in a contest or olympiad, and a diploma or certificate
              already issued, if these Terms or the rules of a particular contest
              are broken — including inaccurate details, attempts to obtain a
              diploma or reward without completing the task, taking a test with
              outside help, automated or bulk entries, and abusive or unethical
              behaviour. The result page stays available and explains the reason.
            </li>
            {/* Language of communication (20.10.2026) — mirrors /terms. */}
            <li>
              Communication on the platform, in the bot, by email and through the
              contact form is in Ukrainian only. We reserve the right to decline
              communication conducted in Russian.
            </li>
            <li>
              A revocation can be appealed by writing to{' '}
              <a href="mailto:hellodityam.com.ua@gmail.com">hellodityam.com.ua@gmail.com</a>.
            </li>
          </ul>

          <h2>7. Confidentiality</h2>
          <p>
            We do not collect a child’s name, school or exact date of birth. To
            select opportunities we store each child’s age range, interests and
            preferred format, the family’s city, and the child’s special
            circumstances (for example, displaced status or disability) — only if
            the user chose to provide them. Data processing is described in the{' '}
            <Link href="/en/privacy">Privacy Policy</Link>.
          </p>

          <h2>8. Liability</h2>
          <p>
            Information about opportunities is for reference; the final conditions
            of participation are set by the organisers of the respective
            programmes. The Seller is not the organiser of third-party programmes
            and does not guarantee admission to them.
          </p>

          <h2>9. Seller details</h2>
          <ul>
            <li>Individual entrepreneur Mariia Oleksandrivna Shutiak</li>
            <li>Taxpayer number (RNOKPP): 3530900201</li>
            {/* Full street address removed on 23 Oct 2026 for safety — city only. */}
            <li>Location: Kyiv, Ukraine. Postal address for official correspondence on request at hellodityam.com.ua@gmail.com</li>
            <li>Phone: <a href="tel:+380634763998">+380 63 476 3998</a></li>
            <li>Email: <a href="mailto:hellodityam.com.ua@gmail.com">hellodityam.com.ua@gmail.com</a></li>
            <li>Website: dityam.com.ua</li>
          </ul>
        </article>
      </div>
      <Footer lang="en" />
    </>
  );
}
