'use client';

import { SITE_EVENTS, sendSiteEvent } from '@/lib/site-events';

/**
 * Зовнішнє посилання в статті блогу (першоджерело: Дія, ПФУ, організатор).
 * Рахує перехід (site_events «blog_outbound», source — «слаг→домен»): для
 * статті забрана морока — це крок до дії, а не перегляд (23.10.2026).
 */
export default function BlogOutLink({ href, children }) {
  const onClick = () => {
    let host = '';
    try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { /* лишаємо порожнім */ }
    const slug = window.location.pathname.split('/').filter(Boolean).pop() || '';
    sendSiteEvent(SITE_EVENTS.BLOG_OUTBOUND, `${slug}→${host}`);
  };
  return <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>{children}</a>;
}
