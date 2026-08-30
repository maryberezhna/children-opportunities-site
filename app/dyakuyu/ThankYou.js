'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const PLUS_BOT = process.env.NEXT_PUBLIC_PLUS_BOT || 'DityamPlusBot';

// Токен привʼязки НЕ кладемо в адресу: він же є unsub_token, тобто ключ до
// чужої відписки. В URL він потрапив би в GA4, у логи сервера й у Referer при
// переході в Telegram. Тому форма кладе його в sessionStorage, а ця сторінка
// звідти забирає.
const CONNECT_KEY = 'dityam_connect_token';

const L = {
  uk: {
    paidTitle: 'Оплата пройшла. Дякуємо 🧡',
    paidLead: 'Підписка активна. Поверніться в бот — там ми поставимо кілька питань про дитину й одразу почнемо надсилати підбірку.',
    paidCta: 'Відкрити бот',
    savedTitle: 'Профіль збережено',
    savedLead: (<>Лишився один крок: відкрийте бот і натисніть <b>Почати</b>. Там оформимо підписку — і підбірка приходитиме саме під вашу дитину.</>),
    warn: (<>Якщо бот не впізнає вас — напишіть у ньому <b>/start</b>, і ми звʼяжемо профіль вручну.</>),
    savedCta: (bot) => `Відкрити @${bot}`,
    back: '← Повернутись до каталогу',
    home: '/',
  },
  en: {
    paidTitle: 'Payment received. Thank you 🧡',
    paidLead: 'Your subscription is active. Head back to the bot — we will ask a few questions about your child and start sending the selection right away.',
    paidCta: 'Open the bot',
    savedTitle: 'Profile saved',
    savedLead: (<>One step left: open the bot and press <b>Start</b>. We will set up the subscription there — and the selection will arrive tailored to your child.</>),
    warn: (<>If the bot does not recognise you, send it <b>/start</b> and we will link the profile by hand.</>),
    savedCta: (bot) => `Open @${bot}`,
    back: '← Back to the catalogue',
    home: '/en',
  },
};

export default function ThankYou({ lang = 'uk' }) {
  const t = L[lang] || L.uk;
  const [token, setToken] = useState(null);
  const [paid, setPaid] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let t = null;
    try {
      t = sessionStorage.getItem(CONNECT_KEY);
      sessionStorage.removeItem(CONNECT_KEY);   // одноразово, щоб не висів
    } catch { /* приватний режим — просто без токена */ }
    const isPaid = new URLSearchParams(window.location.search).get('paid') === '1';
    setToken(t);
    setPaid(isPaid);
    setReady(true);

    // Подія для GA4 і рекламних систем. Окремі назви, бо це різні кроки лійки.
    if (window.gtag) {
      window.gtag('event', isPaid ? 'plus_purchase' : 'plus_signup', {
        event_category: 'conversion',
      });
    }
  }, []);

  if (!ready) return null;

  const botUrl = `https://t.me/${PLUS_BOT}${token ? `?start=${token}` : ''}`;

  return (
    <div className="container">
      <article className="thanks">
        <div className="thanks-mark" aria-hidden="true">✓</div>

        {paid ? (
          <>
            <h1>{t.paidTitle}</h1>
            <p className="thanks-lead">
              {t.paidLead}
            </p>
            <a className="thanks-cta" href={botUrl} target="_blank" rel="noreferrer">
              {t.paidCta}
            </a>
          </>
        ) : (
          <>
            <h1>{t.savedTitle}</h1>
            <p className="thanks-lead">
              {t.savedLead}
            </p>
            <a className="thanks-cta" href={botUrl} target="_blank" rel="noreferrer">
              {t.savedCta(PLUS_BOT)}
            </a>
            {!token && (
              <p className="thanks-warn">
                {t.warn}
              </p>
            )}
          </>
        )}

        <p className="thanks-back">
          <Link href={t.home}>{t.back}</Link>
        </p>
      </article>
    </div>
  );
}
