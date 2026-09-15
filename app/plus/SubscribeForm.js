'use client';
import { PLUS_SALES_OPEN, PLUS_WAITLIST_URL, plusBotUrl } from '@/lib/plus';
import { trackConversion } from '@/lib/track';

/**
 * Продаж Dityam+ на паузі — сторінка лише додає в список очікування, і лише
 * через Telegram: деп-лінк у бота, один тап. До 15.09.2026 поруч була форма
 * з імейлом; листів Dityam+ більше не шле (рішення Марії), тож і пошту не
 * просимо — написати людині в день запуску можна лише в Telegram.
 */
const C = {
  muted: '#54617a',
};

const L = {
  uk: {
    telegram: '✈️ Стати в список через Telegram — один тап',
    fine: 'Жодного спаму: одне повідомлення в Telegram про запуск і знижку для перших.',
    openCta: '✈️ Оформити Dityam+ у Telegram',
    openFine: 'Спершу кілька питань про дитину, потім оплата — усе в боті, за кілька хвилин.',
  },
  en: {
    telegram: '✈️ Join the list through Telegram — one tap',
    fine: 'No spam: one Telegram message about the launch and the early-bird discount.',
    openCta: '✈️ Get Dityam+ on Telegram',
    openFine: 'A few questions about your child first, then payment — all in the bot, in a few minutes.',
  },
};

const button = {
  display: 'block', textAlign: 'center', padding: '15px 20px',
  borderRadius: 12, background: '#1a73a3', color: '#fff',
  fontSize: 16, fontWeight: 700, textDecoration: 'none',
};

export default function SubscribeForm({ lang = 'uk' }) {
  const t = L[lang] || L.uk;

  // Продаж відкрито (lib/plus.js) — замість списку очікування одна кнопка в бот.
  if (PLUS_SALES_OPEN) {
    return (
      <div style={{ marginTop: 26 }}>
        <a href={plusBotUrl(`form_${lang}`)} style={button}>
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
