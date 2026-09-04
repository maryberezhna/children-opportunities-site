import { MENTIONS } from '@/lib/press';

// Смужка логотипів видань, що писали про проєкт. Одна розмітка на всі
// сторінки (/press, /en/press, /about, /en/about): дві копії цього блоку
// вже жили окремо на пресових сторінках і чекали нагоди розʼїхатись —
// як колись підписи підбірок у футері.
export default function PressLogos() {
  return (
    <ul className="press-logos">
      {MENTIONS.map((m) => (
        <li key={m.url}>
          <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            title={m.title}
          >
            <img
              src={m.logo.src}
              width={m.logo.width}
              height={m.logo.height}
              alt={m.outlet}
              className={m.logo.width / m.logo.height < 1.5 ? 'is-square' : undefined}
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
