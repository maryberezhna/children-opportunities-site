'use client';
import { useEffect, useState } from 'react';

// «Щось не так? Повідомити» під фактами сторінки можливості.
//
// До 30.09.2026 одне натискання мовчки писало в opportunity_feedback запис
// 'report' і показувало «Дякуємо, перевіримо» з посиланням на форму. Марія:
// «як мені здогадатися — вони випадково натисли чи прям щось хотіли сказати».
// Справді: клік без тексту не каже ні що не так, ні чи це взагалі навмисне.
//
// Тепер кнопка веде одразу у форму, а сторінка, з якої прийшли, їде в ?url= —
// інакше лист приходив би без найголовнішого. У базу пишемо лише те, що
// людина написала словами; у GA4 лишається подія, щоб бачити, скільки людей
// узагалі натискає.
export default function ReportButton({ id, slug, label, href, className = 'o-report' }) {
  // Адресу сторінки додаємо вже в браузері: на сервері її знає лише сам
  // браузер (мова, місто, параметри). До гідратації посилання веде просто у
  // форму — без підстановки, але робоче.
  const [to, setTo] = useState(href);
  useEffect(() => {
    setTo(`${href}&url=${encodeURIComponent(window.location.href.split('#')[0])}`);
  }, [href]);

  return (
    <a
      className={className}
      href={to}
      onClick={() => {
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'opportunity_report_click', {
            source: 'site', opportunity_id: id, opportunity_slug: slug,
          });
        }
      }}
    >
      {label}
    </a>
  );
}
