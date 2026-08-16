import SubscribeForm from './SubscribeForm';

export const metadata = {
  title: 'Dityam+ — скоро · список очікування',
  description: 'Dityam+ — 179 грн/міс або 1 490 грн/рік: щомісячна персональна добірка під дитину, нагадування про дедлайни, допомога із заявками. Станьте в список — першим знижка.',
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ display: 'inline-block', background: '#fbe7d8', color: '#db5a1e', fontWeight: 700, fontSize: 12.5, letterSpacing: '.03em', padding: '4px 11px', borderRadius: 6 }}>Dityam+</span>
        <span style={{ display: 'inline-block', background: '#db5a1e', color: '#fff', fontWeight: 700, fontSize: 12.5, letterSpacing: '.05em', padding: '4px 11px', borderRadius: 6, textTransform: 'uppercase' }}>скоро</span>
      </div>
      <h1 style={{ fontSize: 32, lineHeight: 1.12, margin: '14px 0 10px', letterSpacing: '-0.01em' }}>Персональна підбірка можливостей для вашої дитини</h1>
      <p style={{ fontSize: 17, color: '#54617a', margin: 0, lineHeight: 1.55 }}>
        Ми готуємо платну підписку Dityam+. Каталог лишається безкоштовним для всіх — ви платите за роботу, а не за доступ. Станьте в список очікування — <b style={{ color: '#131b28' }}>першим буде знижка на старті</b>.
      </p>

      <div style={{ display: 'flex', gap: 12, margin: '24px 0 4px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px', border: '1.5px solid #e3e8f0', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>179 грн<span style={{ fontSize: 14, fontWeight: 600, color: '#54617a' }}> / місяць</span></div>
          <div style={{ fontSize: 13.5, color: '#54617a', marginTop: 2 }}>скасувати можна будь-коли</div>
        </div>
        <div style={{ flex: '1 1 180px', border: '1.5px solid #db5a1e', borderRadius: 12, padding: '14px 18px', position: 'relative' }}>
          <span style={{ position: 'absolute', top: -10, right: 12, background: '#db5a1e', color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>вигідніше на 31%</span>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>1 490 грн<span style={{ fontSize: 14, fontWeight: 600, color: '#54617a' }}> / рік</span></div>
          <div style={{ fontSize: 13.5, color: '#54617a', marginTop: 2 }}>≈ 124 грн/місяць</div>
        </div>
      </div>

      <p style={{ fontSize: 15.5, fontWeight: 700, margin: '20px 0 0', color: '#131b28' }}>Щомісяця ви отримуєте:</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {feature('🎯', 'персональну добірку можливостей для вашої дитини — з сотень карток лишаються ті, що підходять саме їй;')}
        {feature('📅', 'нагадування про дедлайни — за 7 і 2 дні до кінця подачі;')}
        {feature('🔎', 'відбір тільки релевантних програм — за віком, інтересами й містом;')}
        {feature('📝', 'допомогу з подачею заявок;')}
        {feature('✈️', 'доставку добірки в Telegram або email — як вам зручніше.')}
      </ul>

      <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {feature('🔒', 'Безпечно: ми не запитуємо дитячих даних. Лише вік-діапазон та інтереси.')}
        {feature('🧡', 'Каталог лишається безкоштовним для всіх — назавжди.')}
      </ul>

      <SubscribeForm />
    </main>
  );
}
