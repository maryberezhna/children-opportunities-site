import Link from 'next/link';
import { supabase, publicOpportunities, countActiveOpportunities, countActiveSources, FALLBACK } from '@/lib/supabase';
import Footer from '../Footer';

const SITE_URL = 'https://dityam.com.ua';

export const revalidate = 3600;

export const metadata = {
  title: 'Як ми перевіряємо дані — Dityam',
  description:
    'Як працює каталог Dityam: 200+ джерел, щоденні оновлення, автоматична перевірка кожного лінка щоночі, детекція закритих наборів і ручна модерація сумнівного. Чесно про те, що стоїть за словом «перевірено».',
  alternates: {
    canonical: 'https://dityam.com.ua/yak-my-pereviriaiemo',
    // Взаємність обовʼязкова: односторонню анотацію Google ігнорує.
    languages: { uk: 'https://dityam.com.ua/yak-my-pereviriaiemo', en: 'https://dityam.com.ua/en/how-we-verify' },
  },
};

async function getStats() {
  try {
    if (!supabase) return {};
    const [active, verified, sources] = await Promise.all([
      countActiveOpportunities(),
      publicOpportunities('id', { count: 'exact', head: true })
        .gte('last_verified_at', new Date(Date.now() - 3 * 86400000).toISOString()),
      countActiveSources(),
    ]);
    return { active, verified: verified.count, sources };
  } catch {
    return {};
  }
}

const STEPS = [
  {
    icon: '🔎',
    title: 'Щодня збираємо з усіх наших джерел',
    text: 'Державні сайти, фонди, посольства, громадські організації, освітні платформи й Telegram-канали. Скрапери та пошуковий агент працюють щоночі; частота під кожне джерело своя — сезонні (табори навесні, олімпіади восени) перевіряються частіше.',
  },
  {
    icon: '🧠',
    title: 'Структуруємо кожен запис',
    text: 'Із сирого тексту виділяємо головне: вік, тему, місто, вартість, дедлайн. Якщо на сторінці написано «реєстрацію завершено» — запис одразу закривається, навіть якщо сторінка ще жива.',
  },
  {
    icon: '🔗',
    title: 'Перевіряємо кожен лінк щоночі',
    text: 'Усі активні можливості проходять нічну перевірку посилань. Мертвий лінк не ховається одразу — даємо джерелу три доби ожити, і лише потім закриваємо запис. На сторінці кожної можливості видно, коли її перевірено востаннє.',
  },
  {
    icon: '👯',
    title: 'Зліплюємо дублікати',
    text: 'Той самий табір може бути на сайті фонду, у Telegram і в новинах — трьома різними текстами. Система розпізнає такі повтори і лишає один запис, щоб ви не перебирали те саме тричі.',
  },
  {
    icon: '⏳',
    title: 'Не даємо записам застаріти',
    text: 'Можливості без дедлайну (гуртки, курси) регулярно переперевіряються: сторінка жива і набір триває — запис лишається; ні — чесно позначаємо «завершено». Закриті сторінки не зникають: на них плашка і посилання на живий каталог.',
  },
  {
    icon: '🫶',
    title: 'Людина — там, де сумнів',
    text: 'Все нове від пошукового агента і все, у чому система не впевнена, потрапляє на ручну модерацію перед публікацією. Дитячих даних не збираємо взагалі — каталог працює без реєстрації.',
  },
];

export default async function YakPereviriaiemo() {
  const { active, verified, sources } = await getStats();

  return (
    <>
      <div className="container">
        <div className="hero">
          <div className="hero-copy">
            <div className="hero-badges">
              <Link href="/" className="city-back-link">← Всі можливості</Link>
            </div>
            <h1>
              Як ми перевіряємо
              <br />
              <span className="accent">дані каталогу</span>
            </h1>
            <p>
              «Перевірено» на Dityam — це не обіцянка, а щоденний процес. Ось як
              він влаштований — чесно і без магії.
            </p>
            <div className="stats">
              <div className="stat">
                <span className="stat-num">{active ?? FALLBACK.opportunities}</span>
                <span className="stat-label">активних можливостей</span>
              </div>
              <div className="stat">
                <span className="stat-num">{verified ?? '—'}</span>
                <span className="stat-label">з лінком, перевіреним за 3 доби</span>
              </div>
              <div className="stat">
                <span className="stat-num">{sources ?? FALLBACK.sources}</span>
                <span className="stat-label">джерел щодня</span>
              </div>
            </div>
          </div>
        </div>

        <section className="topic-faq" style={{ maxWidth: 760 }}>
          {STEPS.map((s) => (
            <div key={s.title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 26, lineHeight: 1.2 }} aria-hidden="true">{s.icon}</span>
              <div>
                <h2 style={{ fontSize: 17, margin: '0 0 4px' }}>{s.title}</h2>
                <p style={{ margin: 0, color: 'var(--ink-soft)', fontSize: 15, lineHeight: 1.6 }}>{s.text}</p>
              </div>
            </div>
          ))}
        </section>

        <p className="topic-note" style={{ marginTop: 24 }}>
          Побачили помилку чи мертве посилання? <a href="mailto:maryberezhna@gmail.com?subject=Помилка%20на%20dityam.com.ua">Напишіть нам</a> —
          виправимо і скажемо дякую. А якщо знаєте можливість, якої в каталозі нема —{' '}
          <a href="mailto:maryberezhna@gmail.com?subject=Додати%20можливість">пропонуйте</a>.
        </p>
        <Footer />
      </div>
    </>
  );
}
