import LangEn from './LangEn';

// Заголовок вкладки англійських сторінок (23.10.2026). Без цього шаблону
// діяв кореневий — «%s | Можливості для дитини», і людина з Польщі бачила
// у вкладці англійську назву з українським хвостом. Бренд — лише
// «Dityam.com.ua» повністю.
export const metadata = {
  title: { template: '%s | Dityam.com.ua', default: 'Dityam.com.ua — opportunities for Ukrainian children' },
};

// Вкладений layout для /en: єдине завдання — lang="en" на <html>
// (див. LangEn.js). Розмітку не змінює.
export default function EnLayout({ children }) {
  return (
    <>
      <LangEn />
      {children}
    </>
  );
}
