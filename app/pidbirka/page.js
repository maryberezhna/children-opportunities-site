import SubscribeForm from './SubscribeForm';

export const metadata = {
  title: 'Персональна підбірка — Dityam+',
  description: 'Раз на 2 тижні — підібрані під вашу дитину можливості в Telegram або на email. Без точних даних дитини.',
};

const box = { maxWidth: 640, margin: '48px auto 90px', padding: '0 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#131b28' };

const feature = (icon, text) => (
  <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, color: '#2a3444', lineHeight: 1.5 }}>
    <span style={{ fontSize: 17, lineHeight: 1.3 }}>{icon}</span><span>{text}</span>
  </li>
);

export default function PidbirkaPage() {
  return (
    <main style={box}>
      <div style={{ display: 'inline-block', background: '#fbe7d8', color: '#db5a1e', fontWeight: 700, fontSize: 12.5, letterSpacing: '.03em', padding: '4px 11px', borderRadius: 6 }}>Dityam+</div>
      <h1 style={{ fontSize: 32, lineHeight: 1.12, margin: '14px 0 10px', letterSpacing: '-0.01em' }}>Персональна підбірка можливостей для вашої дитини</h1>
      <p style={{ fontSize: 17, color: '#54617a', margin: 0, lineHeight: 1.55 }}>
        Раз на 2 тижні надсилаємо добірку, підібрану під вік та інтереси дитини — у Telegram або на email. Найактивніші батьки дізнаються про найкраще першими.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {feature('🎯', 'Підбірка під вік та інтереси — без зайвого шуму.')}
        {feature('🔒', 'Безпечно: жодних точних даних дитини. Лише вік-діапазон та інтереси.')}
        {feature('✈️', 'Ваш канал на вибір — Telegram або email.')}
        {feature('🧡', 'Базовий пошук на сайті лишається безкоштовним для всіх — це доповнення, а не платний вхід.')}
      </ul>

      <SubscribeForm />
    </main>
  );
}
