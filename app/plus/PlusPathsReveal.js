'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * «Три шляхи» на /plus проявляються як шлях: лінія тягнеться вниз, сходинки
 * зʼявляються по черзі, і вся картка відкривається приблизно за 5 секунд
 * (Марія 15.09.2026). Кожна картка стартує, коли потрапляє на екран: на
 * телефоні вони стоять одна під одною, і спільний старт відіграв би нижні
 * поза екраном.
 *
 * Без JS, до гідрації й із prefers-reduced-motion усе видно одразу:
 * прихований стан у CSS діє лише під класом is-armed, який ставимо тут.
 */
export default function PlusPathsReveal({ className, children }) {
  const ref = useRef(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (!('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.25 });
    ref.current.querySelectorAll('.pl-path').forEach((el) => io.observe(el));
    setArmed(true);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${className}${armed ? ' is-armed' : ''}`}>
      {children}
    </div>
  );
}
