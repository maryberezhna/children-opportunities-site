import Link from 'next/link';

const SITE_URL = 'https://dityam.com.ua';

/**
 * «Маєте ідею? Зв’яжіться з нами» — унизу блогу й кожної статті (Марія
 * 22.10.2026, її слова дослівно). Веде на контактну форму з типом «Інше» і
 * адресою сторінки, з якої людина прийшла (?url=), щоб було видно, про яку
 * статтю йдеться. Стиль — той самий світлий рядок, що «Маєте можливість для
 * дітей?» у підбірках (.tp-main .suggest-card).
 */
export default function BlogIdea({ path = '/blog' }) {
  const href = `/contacts?type=other&url=${encodeURIComponent(`${SITE_URL}${path}`)}`;
  return (
    <section className="suggest-card blog-idea" aria-labelledby="blog-idea-title">
      <h2 id="blog-idea-title">Маєте ідею?</h2>
      <Link href={href} prefetch={false} className="suggest-cta">Зв’яжіться з нами</Link>
    </section>
  );
}
