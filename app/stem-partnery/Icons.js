// Лінійні іконки номінацій для /stem-partnery — стриманіші за дудли
// (Марія, 05.10.2026: «наче дуже по-дитячому, зроби трошки доросліше»).
const base = {
  viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
};

export function CodeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M17 15 8 24l9 9" />
      <path d="m31 15 9 9-9 9" />
      <path d="m27 11-6 26" />
    </svg>
  );
}

export function RobotIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="10" y="15" width="28" height="22" rx="6" />
      <path d="M24 9v6" />
      <circle cx="24" cy="7" r="2" />
      <circle cx="18.5" cy="25" r="2.5" />
      <circle cx="29.5" cy="25" r="2.5" />
      <path d="M19 31.5h10" />
      <path d="M6 22v8M42 22v8" />
    </svg>
  );
}

export function AtomIcon(props) {
  return (
    <svg {...base} {...props}>
      <ellipse cx="24" cy="24" rx="18" ry="7" />
      <ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(60 24 24)" />
      <ellipse cx="24" cy="24" rx="18" ry="7" transform="rotate(-60 24 24)" />
      <circle cx="24" cy="24" r="2.6" fill="currentColor" />
    </svg>
  );
}
