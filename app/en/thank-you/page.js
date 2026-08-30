import ThankYou from '../../dyakuyu/ThankYou';

// Окремий URL, а не блок «Готово!» всередині форми: рекламні системи рахують
// конверсію за адресою сторінки, тож їм треба дати адресу, яку людина бачить
// ПІСЛЯ дії. noindex — сторінка не має сенсу в пошуку й не повинна
// конкурувати з /en/plus.
export const metadata = {
  title: 'Thank you — Dityam+',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ThankYou lang="en" />;
}
