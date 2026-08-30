import Link from 'next/link';

export const metadata = {
  title: 'No connection — dityam.com.ua',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="container" lang="en">
      <article className="legal-page">
        <h1>You are offline</h1>
        <p className="lead">
          This page has not been opened before, so there is no saved copy to
          show you.
        </p>
        <p>
          Pages you have already visited work without a connection — try going
          back. Everything returns to normal as soon as you are online again.
        </p>
        <p>
          <Link href="/en">← Back to the catalogue</Link>
        </p>
      </article>
    </div>
  );
}
