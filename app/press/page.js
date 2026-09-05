import { pressStats } from '@/lib/press';
import PressKit from '../PressKit';

export const metadata = {
  title: 'Для медіа — прескіт dityam.com.ua',
  description:
    'Прескіт dityam.com.ua: цифри проєкту, опис одним абзацом, публікації, логотипи, контакт для журналістів. Платформа можливостей для українських дітей 0–18 років.',
  alternates: {
    canonical: 'https://dityam.com.ua/press',
    languages: {
      uk: 'https://dityam.com.ua/press',
      en: 'https://dityam.com.ua/en/press',
    },
  },
};

// Цифри тягнемо живими: журналіст цитує те, що бачить, тож застаріле «280+»
// у статичному тексті рано чи пізно стало б помилкою в чужій публікації.
export const revalidate = 3600;

export default async function PressPage() {
  const stats = await pressStats();
  return <PressKit stats={stats} />;
}
