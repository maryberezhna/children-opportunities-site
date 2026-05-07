'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

const PAYPAL_CLIENT_ID =
  'BAA2pQk4kuFGBcBFju04YwkQznspoTsbJ7deKn9cjlQvKHTFzZqtjImhlEPO1GemMTkG-kweIC28q5To0E';
const HOSTED_BUTTON_ID = 'E8TTAWRZSCM3S';
const SDK_SRC = `https://www.paypal.com/sdk/js?client-id=${PAYPAL_CLIENT_ID}&components=hosted-buttons&disable-funding=venmo&currency=USD`;

export default function PayPalButton() {
  const renderedRef = useRef(false);

  const tryRender = () => {
    if (renderedRef.current) return;
    if (typeof window === 'undefined' || !window.paypal?.HostedButtons) return;
    renderedRef.current = true;
    window.paypal
      .HostedButtons({ hostedButtonId: HOSTED_BUTTON_ID })
      .render(`#paypal-container-${HOSTED_BUTTON_ID}`);
    if (window.gtag) window.gtag('event', 'paypal_button_render');
  };

  useEffect(() => {
    tryRender();
  }, []);

  return (
    <>
      <Script src={SDK_SRC} strategy="afterInteractive" onLoad={tryRender} />
      <div id={`paypal-container-${HOSTED_BUTTON_ID}`} className="paypal-container" />
    </>
  );
}
