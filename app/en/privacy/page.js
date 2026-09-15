import Link from 'next/link';
import Footer from '../../Footer';

export const metadata = {
  title: 'Privacy Policy — Dityam',
  description:
    'What data Dityam.com.ua collects — on the site, in the Telegram bots and in the Dityam+ subscription — why, who receives it, how long it is kept and how to delete it.',
  alternates: {
    canonical: 'https://dityam.com.ua/en/privacy',
    languages: {
      uk: 'https://dityam.com.ua/privacy',
      en: 'https://dityam.com.ua/en/privacy',
    },
  },
  robots: { index: true, follow: true },
};

const UPDATED = '15 September 2026';

export default function PrivacyPageEn() {
  return (
    <>
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

          <h2>1. Who processes the data</h2>
          <p>
            The Dityam.com.ua platform of opportunities for children and the paid
            Dityam+ subscription. The data controller is individual entrepreneur
            Mariia Oleksandrivna Shutiak, taxpayer number (RNOKPP) 3530900201. Full
            details are in the <Link href="/en/terms">Public offer</Link>. For
            questions about data, write to{' '}
            <a href="mailto:hellodityam.com.ua@gmail.com">hellodityam.com.ua@gmail.com</a>.
          </p>

          <h2>2. What data we collect and why</h2>
          <ul>
            <li>
              <strong>Visiting the site.</strong> Google Analytics, Hotjar and Google
              Ads tags receive data about your device, browser, language, the pages
              you view and your actions on them — so we understand what people use
              and can measure advertising.
            </li>
            <li>
              <strong>Dityam+ waitlist.</strong> You can join only through the
              @DityamPlusBot Telegram bot: we keep your Telegram chat ID and username
              so we can tell you about the launch. Emails left on the site before 15 September 2026 are kept until
              you ask us to delete them; we send no emails to them.
            </li>
            <li>
              <strong>“Suggest an opportunity” form.</strong> Title, link, comment
              and, optionally, your contact — to check and publish the opportunity
              and reply to you.
            </li>
            <li>
              <strong>Contact form.</strong> Type of request, message, name, email or
              phone, and the page you are writing from — to reply.
            </li>
            <li>
              <strong>@DityamComUABot and the channel.</strong> Your Telegram chat ID
              and username if you joined the waitlist through this bot before
              15 September 2026; your “Interested / Not
              interested” marks together with your Telegram account ID.
            </li>
            <li>
              <strong>Dityam+ subscription (@DityamPlusBot).</strong> Telegram chat
              ID and username; your phone number if you shared it; for each child —
              age group, interests, preferred formats and, optionally, special
              circumstances (section 3); the family’s city or format (online,
              abroad) and whether to show only free opportunities; which reminders
              have already been sent. All of this is used to select opportunities
              and remind you about deadlines.
            </li>
            <li>
              <strong>Payment.</strong> We store the order number, the plan (monthly
              or annual) and the subscription status. Card details are entered on
              WayForPay’s side — we never see or store them.
            </li>
          </ul>
          <p>
            We <strong>do not collect</strong> a child’s name, school, photo or exact
            date of birth.
          </p>

          <h2>3. A child’s special circumstances</h2>
          <p>
            The Dityam+ profile lets you mark: gifted, disability, internally
            displaced, child of a defender, from a frontline community, orphan, from a
            low-income or large family, cancer. This is sensitive data, so:
          </p>
          <ul>
            <li>providing it is optional — the subscription works without it;</li>
            <li>we use it only to select opportunities the child is eligible for;</li>
            <li>we do not pass it to analytics or advertising services;</li>
            <li>you can change or remove it by filling in the profile in the bot again, or by writing to us.</li>
          </ul>

          <h2>4. Who receives the data</h2>
          <p>We do not sell personal data. It is processed by services the platform cannot run without:</p>
          <ul>
            <li>
              <strong>Supabase</strong> — the database holding the records in section 2
              (<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer">policy</a>).
            </li>
            <li>
              <strong>Vercel</strong> — site hosting
              (<a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">policy</a>).
            </li>
            <li>
              <strong>Telegram</strong> — delivering bot and channel messages
              (<a href="https://telegram.org/privacy" target="_blank" rel="noopener noreferrer">policy</a>).
            </li>
            <li>
              <strong>WayForPay</strong> — subscription payments; receives your email
              and phone (if available) and the order number
              (<a href="https://wayforpay.com/en/oferta-page" target="_blank" rel="noopener noreferrer">terms</a>).
            </li>
            <li>
              <strong>Google</strong> — Analytics, Google Ads, and Gmail, which we use
              to send emails
              (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policy</a>).
            </li>
            <li>
              <strong>Hotjar</strong> — behaviour analytics on the site
              (<a href="https://www.hotjar.com/legal/policies/privacy/" target="_blank" rel="noopener noreferrer">policy</a>).
            </li>
            <li>
              <strong>Anthropic</strong> — the AI model that parses suggested
              opportunities; it receives the title, link and page text, but not your
              contact
              (<a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer">policy</a>).
            </li>
            <li>
              <strong>GitHub</strong> — automated jobs that build daily selections
              and reminders for subscribers
              (<a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">policy</a>).
            </li>
            <li>
              <strong>Notion</strong> — moderation notes; they may contain the contact
              of the person who suggested an opportunity
              (<a href="https://www.notion.com/trust/privacy-policy" target="_blank" rel="noopener noreferrer">policy</a>).
            </li>
            <li>
              <strong>PayPal</strong> — only if you support the project with the
              PayPal button on the support page
              (<a href="https://www.paypal.com/ua/legalhub/privacy-full" target="_blank" rel="noopener noreferrer">policy</a>).
            </li>
          </ul>
          <p>
            These companies’ servers may be located outside Ukraine. Form messages,
            suggested opportunities and subscribers’ questions are forwarded to the
            platform administrator’s working Telegram chat.
          </p>

          <h2>5. Cookies and browser storage</h2>
          <p>
            Technical cookies and browser storage remember your language,
            accessibility settings, viewing mode and whether you have closed the
            subscription pop-up. Analytics and advertising cookies are set by Google
            Analytics, Google Ads and Hotjar, which load together with the page. You
            can block them in your browser settings or with an extension; the site
            works without them.
          </p>

          <h2>6. How long we keep data</h2>
          <p>
            Data is kept until you ask us to delete it. After you cancel with{' '}
            <code>/stop</code>, your profile and contacts stay in the database so the
            subscription can be restored, but messages and charges stop. To delete
            your data completely, write to{' '}
            <a href="mailto:hellodityam.com.ua@gmail.com">hellodityam.com.ua@gmail.com</a>{' '}
            or to the bot — we will delete it within 30 days. WayForPay keeps payment
            records in line with its own legal obligations.
          </p>

          <h2>7. Your rights</h2>
          <p>
            Under the Law of Ukraine “On Personal Data Protection” (and the GDPR for
            users in the EU) you have the right to:
          </p>
          <ul>
            <li>know what data about you is stored and obtain it;</li>
            <li>request correction or deletion of that data;</li>
            <li>withdraw your consent to processing at any time;</li>
            <li>lodge a complaint with the Ukrainian Parliament Commissioner for Human Rights.</li>
          </ul>
          <p>
            To do so, write to{' '}
            <a href="mailto:hellodityam.com.ua@gmail.com">hellodityam.com.ua@gmail.com</a>.
          </p>

          <h2>8. Changes to this policy</h2>
          <p>
            We update this policy when what we collect or who receives it changes.
            The date of the last update is at the top of the page.
          </p>
        </article>
      </div>
      <Footer lang="en" />
    </>
  );
}
