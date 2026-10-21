'use client';
import { useEffect } from 'react';

/**
 * Англійські сторінки живуть під спільним кореневим layout з <html lang="uk">,
 * а Google (International and multilingual sites) і читачі з екрана чекають
 * мовний сигнал на самій сторінці. Окремий кореневий layout для /en означав би
 * дублювати шрифти, аналітику й шапку, тому мова ставиться тут: Googlebot
 * рендерить JS і бачить lang="en" після рендеру. При переході на українську
 * сторінку атрибут повертається.
 */
export default function LangEn() {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.lang;
    el.lang = 'en';
    return () => { el.lang = prev || 'uk'; };
  }, []);
  return null;
}
