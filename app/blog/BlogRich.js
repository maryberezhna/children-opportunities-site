import Link from 'next/link';
import { richParts } from '@/lib/blog';
import BlogOutLink from './BlogOutLink';

/**
 * Текст статті з розміткою [текст](адреса): внутрішні посилання — Link
 * (перелінковка з підбірками й путівниками), зовнішні — у новій вкладці, і
 * перехід рахується (BlogOutLink).
 */
export default function BlogRich({ text }) {
  return (
    <>
      {richParts(text).map((p, i) => {
        if (!p.href) return <span key={i}>{p.text}</span>;
        if (p.internal) return <Link key={i} href={p.href}>{p.text}</Link>;
        return <BlogOutLink key={i} href={p.href}>{p.text}</BlogOutLink>;
      })}
    </>
  );
}
