'use client';
import { PLUS_SALES_OPEN, PLUS_WAITLIST_URL, plusFromUrl, PLUS_FREE } from '@/lib/plus';
import { trackConversion } from '@/lib/track';

/**
 * Продаж Dityam+ на паузі — сторінка лише додає в список очікування, і лише
 * через Telegram: деп-лінк у бота, один тап. До 15.09.2026 поруч була форма
 * з імейлом; листів Dityam+ більше не шле (рішення Марії), тож і пошту не
 * просимо — написати людині в день запуску можна лише в Telegram.
 */
const C = {
  // Токен, а не число: у нічній темі цей сірий давав 2,5:1 на темному тлі.
  muted: 'var(--v2-ink-2)',
};

const L = {
  uk: {
    telegram: '✈️ Стати в список через Telegram — один тап',
    fine: 'Жодного спаму: одне повідомлення в Telegram про запуск і знижку для перших.',
    openCta: '✈️ Оформити Dityam+ у Telegram',
    openFine: PLUS_FREE
      ? 'Кілька питань про дитину — і все, за кілька хвилин у боті. Оплати немає.'
      : 'Спершу кілька питань про дитину, потім оплата — усе в боті, за кілька хвилин.',
    // Ціна біля кнопки (Марія, 12.10.2026: «додай тут ціну»).
    priceFirst: (p) => `${p.month} грн на місяць`,
    freeFirst: 'Безкоштовно',
    freeThen: 'Ні оплати, ні картки — лише кілька питань у боті',
    // «Там можна тільки за 1 грн» (Марія): у боті перший крок — лише місяць за 1 грн, пів року тут не пропонуємо.
    priceThen: (p) => `або ${p.half} грн за пів року · скасувати можна будь-коли`,
  },
  en: {
    telegram: '✈️ Join the list through Telegram — one tap',
    fine: 'No spam: one Telegram message about the launch and the early-bird discount.',
    openCta: '✈️ Get Dityam+ on Telegram',
    openFine: PLUS_FREE
      ? 'A few questions about your child, and that is it — a few minutes in the bot. Nothing to pay.'
      : 'A few questions about your child first, then payment — all in the bot, in a few minutes.',
    priceFirst: (p) => `UAH ${p.month} a month`,
    freeFirst: 'Free',
    freeThen: 'No payment, no card — just a few questions in the bot',
    priceThen: (p) => `or UAH ${p.half} for six months · cancel anytime`,
  },
};

const button = {
  display: 'block', textAlign: 'center', padding: '15px 20px',
  borderRadius: 12, background: '#1a73a3', color: '#fff',
  fontSize: 16, fontWeight: 700, textDecoration: 'none',
};

export default function SubscribeForm({ lang = 'uk', prices = null }) {
  const t = L[lang] || L.uk;

  // Продаж відкрито (lib/plus.js) — замість списку очікування одна кнопка в бот.
  if (PLUS_SALES_OPEN) {
    return (
      <div style={{ marginTop: 26 }}>
        {/* Поки Dityam+ безкоштовний, ціна поступається місцем слову «безкоштовно». */}
        {PLUS_FREE || prices ? (
          <div style={{ textAlign: 'center', margin: '0 0 18px' }}>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
              {PLUS_FREE ? t.freeFirst : t.priceFirst(prices)}
            </div>
            <div style={{ marginTop: 6, fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
              {PLUS_FREE ? t.freeThen : t.priceThen(prices)}
            </div>
          </div>
        ) : null}
        <a
          href={plusFromUrl(`plus_form_${lang}`)}
          style={button}
          onClick={() => trackConversion('plus_bot_click', { event_label: `plus_form_${lang}` })}
        >
          {t.openCta}
        </a>
        <p style={{ margin: '14px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
          {t.openFine}
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 26 }}>
      <a
        href={PLUS_WAITLIST_URL}
        style={button}
        onClick={() => trackConversion('plus_waitlist_tg_click', { event_label: `pidbirka_${lang}` })}
      >
        {t.telegram}
      </a>
      <p style={{ margin: '14px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.5 }}>
        {t.fine}
      </p>
    </div>
  );
}
