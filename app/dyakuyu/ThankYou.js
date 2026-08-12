'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const PLUS_BOT = process.env.NEXT_PUBLIC_PLUS_BOT || 'DityamPlusBot';

// Токен привʼязки НЕ кладемо в адресу: він же є unsub_token, тобто ключ до
// чужої відписки. В URL він потрапив би в GA4, у логи сервера й у Referer при
// переході в Telegram. Тому форма кладе його в sessionStorage, а ця сторінка
// звідти забирає.
const CONNECT_KEY = 'dityam_connect_token';

export default function ThankYou() {
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
            <h1>Оплата пройшла. Дякуємо 🧡</h1>
            <p className="thanks-lead">
              Підписка активна. Поверніться в бот — там ми поставимо кілька
              питань про дитину й одразу почнемо надсилати підбірку.
            </p>
            <a className="thanks-cta" href={botUrl} target="_blank" rel="noreferrer">
              Відкрити бот
            </a>
          </>
        ) : (
          <>
            <h1>Профіль збережено</h1>
            <p className="thanks-lead">
              Лишився один крок: відкрийте бот і натисніть <b>Почати</b>. Там
              оформимо підписку — і підбірка приходитиме саме під вашу дитину.
            </p>
            <a className="thanks-cta" href={botUrl} target="_blank" rel="noreferrer">
              Відкрити @{PLUS_BOT}
            </a>
            {!token && (
              <p className="thanks-warn">
                Якщо бот не впізнає вас — напишіть у ньому <b>/start</b>, і ми
                звʼяжемо профіль вручну.
              </p>
            )}
          </>
        )}

        <p className="thanks-back">
          <Link href="/">← Повернутись до каталогу</Link>
        </p>
      </article>
    </div>
  );
}
