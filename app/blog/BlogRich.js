import Link from 'next/link';
import { richParts } from '@/lib/blog';

/**
 * Текст статті з розміткою [текст](адреса): внутрішні посилання — Link
 * (перелінковка з підбірками й путівниками), зовнішні — у новій вкладці.
 */
export default function BlogRich({ text }) {
  return (
    <>
      {richParts(text).map((p, i) => {
        if (!p.href) return <span key={i}>{p.text}</span>;
        if (p.internal) return <Link key={i} href={p.href}>{p.text}</Link>;
        return <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">{p.text}</a>;
      })}
    </>
  );
}
