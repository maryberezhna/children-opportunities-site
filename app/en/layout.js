import LangEn from './LangEn';

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
