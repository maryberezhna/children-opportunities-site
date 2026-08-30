import SubscribeForm from '../../pidbirka/SubscribeForm';

const SITE_URL = 'https://dityam.com.ua';

export const metadata = {
  title: 'Dityam+ — coming soon · waiting list',
  description:
    'Dityam+ — UAH 179/month or UAH 1,490/year: a monthly personal selection for your child, deadline reminders, help with applications. Join the list — early members get a discount.',
  alternates: {
    canonical: `${SITE_URL}/en/plus`,
    languages: { uk: `${SITE_URL}/pidbirka`, en: `${SITE_URL}/en/plus` },
  },
};

const box = { maxWidth: 640, margin: '48px auto 90px', padding: '0 20px', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#131b28' };

const feature = (icon, text) => (
  <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, color: '#2a3444', lineHeight: 1.5 }}>
    <span style={{ fontSize: 17, lineHeight: 1.3 }}>{icon}</span><span>{text}</span>
  </li>
);

export default function PlusPage() {
  return (
    <main style={box} lang="en">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ display: 'inline-block', background: '#fbe7d8', color: '#db5a1e', fontWeight: 700, fontSize: 12.5, letterSpacing: '.03em', padding: '4px 11px', borderRadius: 6 }}>Dityam+</span>
        <span style={{ display: 'inline-block', background: '#db5a1e', color: '#fff', fontWeight: 700, fontSize: 12.5, letterSpacing: '.05em', padding: '4px 11px', borderRadius: 6, textTransform: 'uppercase' }}>soon</span>
      </div>
      <h1 style={{ fontSize: 32, lineHeight: 1.12, margin: '14px 0 10px', letterSpacing: '-0.01em' }}>A personal selection of opportunities for your child</h1>
      <p style={{ fontSize: 17, color: '#54617a', margin: 0, lineHeight: 1.55 }}>
        We are building a paid Dityam+ subscription. The catalogue stays free for everyone — you pay for the work, not for access. Join the waiting list and <b style={{ color: '#131b28' }}>get a discount at launch</b>.
      </p>

      <div style={{ display: 'flex', gap: 12, margin: '24px 0 4px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px', border: '1.5px solid #e3e8f0', borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>UAH 179<span style={{ fontSize: 14, fontWeight: 600, color: '#54617a' }}> / month</span></div>
          <div style={{ fontSize: 13.5, color: '#54617a', marginTop: 2 }}>cancel any time</div>
        </div>
        <div style={{ flex: '1 1 180px', border: '1.5px solid #db5a1e', borderRadius: 12, padding: '14px 18px', position: 'relative' }}>
          <span style={{ position: 'absolute', top: -10, right: 12, background: '#db5a1e', color: '#fff', fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>save 31%</span>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>UAH 1,490<span style={{ fontSize: 14, fontWeight: 600, color: '#54617a' }}> / year</span></div>
          <div style={{ fontSize: 13.5, color: '#54617a', marginTop: 2 }}>≈ UAH 124 a month</div>
        </div>
      </div>

      <p style={{ fontSize: 15.5, fontWeight: 700, margin: '20px 0 0', color: '#131b28' }}>Every month you get:</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {feature('🎯', 'a personal selection of opportunities for your child — out of hundreds of cards, only the ones that fit;')}
        {feature('📅', 'deadline reminders — 7 days and 2 days before applications close;')}
        {feature('🔎', 'only relevant programmes — filtered by age, interests and city;')}
        {feature('📝', 'help with submitting applications;')}
        {feature('✈️', 'delivery to Telegram or email — whichever suits you.')}
      </ul>

      <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {feature('🔒', 'Safe: we never ask for a child’s personal data. Only an age range and interests.')}
        {feature('🧡', 'The catalogue stays free for everyone — forever.')}
      </ul>

      <SubscribeForm lang="en" />
    </main>
  );
}
