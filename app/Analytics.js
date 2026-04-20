'use client';
import Script from 'next/script';

export function Analytics() {
  return (
    <>
      <Script
        defer
        data-domain={process.env.NEXT_PUBLIC_SITE_DOMAIN || 'children-opportunities-site.vercel.app'}
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    </>
  );
}
