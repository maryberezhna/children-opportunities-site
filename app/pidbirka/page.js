import SubscribeForm from './SubscribeForm';

export const metadata = {
  title: 'Персональна підбірка — Dityam+',
  description: 'Можливості з дедлайном, яких немає в загальному каталозі — конкурси, стипендії, обміни, табори. Під вік та інтереси дитини, у Telegram або на email.',
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
        У каталозі — те, що доступно завжди. У Dityam+ — те, що треба встигнути: конкурси, стипендії, обміни, табори. Відбираємо вручну, надсилаємо під вік та інтереси дитини, поки подача відкрита.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {feature('⚡', 'Можливості з дедлайном, яких немає в загальному каталозі.')}
        {feature('🔒', 'Безпечно: ми не запитуємо дитячих даних. Лише вік-діапазон та інтереси.')}
        {feature('✈️', 'Ваш канал на вибір — Telegram або email.')}
        {feature('🧡', 'Держдопомога, виплати й постійні програми лишаються безкоштовними на сайті — назавжди.')}
      </ul>

      <SubscribeForm />
    </main>
  );
}
