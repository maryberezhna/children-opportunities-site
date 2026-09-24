'use client';

/**
 * Запобіжник на сторінці після оплати.
 *
 * 24.09.2026 людина заплатила — і на повернення з WayForPay отримала голе
 * «500 | Internal Server Error» у вбудованому браузері Telegram. Гроші при
 * цьому пройшли, підписка стала активною, але з екрана цього ніяк не було
 * видно: людина бачить помилку рівно в ту мить, коли щойно віддала гроші.
 *
 * Причину того випадку відтворити не вдалося (сторінка статична, віддається
 * з кешу; рендер трапляється лише при промаху кешу — зокрема на першому
 * заході після деплою). Тому тут не діагностика, а страховка: хай би що
 * впало в рендері, людина побачить, що оплата пройшла й куди йти далі.
 *
 * Помилку не ковтаємо — console.error лишає її в логах Vercel.
 */
export default function ThankYouError({ error, reset }) {
  if (typeof console !== 'undefined') console.error('[dyakuyu] render failed', error);

  const paid = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('paid') === '1';

  return (
    <main style={{
      maxWidth: 520, margin: '15vh auto 0', padding: '0 24px',
      fontFamily: 'system-ui, -apple-system, sans-serif', color: '#131b28', textAlign: 'center',
    }}
    >
      <h1 style={{ fontSize: 24, lineHeight: 1.25, margin: '0 0 12px' }}>
        {paid ? 'Оплата пройшла. Дякуємо 🧡' : 'Сторінка не відкрилась'}
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.55, color: '#54617a', margin: '0 0 24px' }}>
        {paid
          ? 'Підписка активна — ця сторінка просто не намалювалась. Підтвердження вже чекає в боті.'
          : 'Щось пішло не так на нашому боці. Спробуйте ще раз або відкрийте бот.'}
      </p>
      <a
        href="https://t.me/DityamPlusBot"
        style={{
          display: 'inline-block', padding: '13px 26px', borderRadius: 10,
          background: '#c8501a', color: '#fff', textDecoration: 'none', fontWeight: 600,
        }}
      >
        Відкрити бот
      </a>
      <p style={{ marginTop: 18 }}>
        <button
          type="button"
          onClick={reset}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: '#6b6b6b', fontSize: 14, textDecoration: 'underline',
          }}
        >
          Спробувати ще раз
        </button>
      </p>
    </main>
  );
}
