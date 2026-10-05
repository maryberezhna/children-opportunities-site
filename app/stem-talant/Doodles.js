// Ілюстрації-дудли для /stem-talant: прості SVG з темним контуром, як
// намальовані від руки (за зразком noospherespace.art, який обрала Марія).
// Декор — aria-hidden; кольори свідомо фіксовані, не токени теми.

const INK = '#1E2A5A';
const common = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round', strokeLinecap: 'round' };

function Svg({ className, children, viewBox = '0 0 120 120' }) {
  return (
    <svg className={className} viewBox={viewBox} aria-hidden="true" focusable="false">
      <g {...common}>{children}</g>
    </svg>
  );
}

export function Rocket({ className }) {
  return (
    <Svg className={className}>
      <path d="M48 92 Q60 118 72 92 Z" fill="#FF7A59" />
      <path d="M44 70 L26 92 L47 89 Z" fill="#7B61FF" />
      <path d="M76 70 L94 92 L73 89 Z" fill="#7B61FF" />
      <path d="M60 10 C83 28 85 60 76 90 L44 90 C35 60 37 28 60 10 Z" fill="#F4F1FF" />
      <circle cx="60" cy="48" r="11" fill="#3DD6B5" />
    </Svg>
  );
}

export function Robot({ className }) {
  return (
    <Svg className={className}>
      <line x1="60" y1="16" x2="60" y2="28" />
      <circle cx="60" cy="12" r="6" fill="#FF7A59" />
      <rect x="18" y="44" width="10" height="18" rx="4" fill="#3DD6B5" />
      <rect x="92" y="44" width="10" height="18" rx="4" fill="#3DD6B5" />
      <rect x="28" y="28" width="64" height="50" rx="14" fill="#FFC93C" />
      <circle cx="46" cy="50" r="8" fill="#FFFFFF" />
      <circle cx="74" cy="50" r="8" fill="#FFFFFF" />
      <circle cx="47" cy="51" r="3" fill={INK} stroke="none" />
      <circle cx="75" cy="51" r="3" fill={INK} stroke="none" />
      <path d="M46 66 Q60 75 74 66" fill="none" />
      <rect x="38" y="82" width="44" height="26" rx="8" fill="#7B61FF" />
      <circle cx="60" cy="95" r="5" fill="#FFC93C" />
    </Svg>
  );
}

export function Atom({ className }) {
  return (
    <Svg className={className}>
      <ellipse cx="60" cy="60" rx="48" ry="18" fill="none" stroke="#2D5BD8" />
      <ellipse cx="60" cy="60" rx="48" ry="18" fill="none" stroke="#2D5BD8" transform="rotate(60 60 60)" />
      <ellipse cx="60" cy="60" rx="48" ry="18" fill="none" stroke="#2D5BD8" transform="rotate(-60 60 60)" />
      <circle cx="60" cy="60" r="10" fill="#FF7A59" />
    </Svg>
  );
}

export function Planet({ className }) {
  return (
    <Svg className={className}>
      <circle cx="60" cy="60" r="30" fill="#FF7A59" />
      <circle cx="50" cy="52" r="5" fill="#FFB199" />
      <circle cx="68" cy="70" r="4" fill="#FFB199" />
      <ellipse cx="60" cy="62" rx="54" ry="13" fill="none" stroke="#FFC93C" strokeWidth="6" transform="rotate(-18 60 60)" />
    </Svg>
  );
}

export function Star({ className }) {
  return (
    <Svg className={className}>
      <path d="M60 10 L72 44 L108 46 L80 68 L90 104 L60 84 L30 104 L40 68 L12 46 L48 44 Z" fill="#FFC93C" />
    </Svg>
  );
}

export function Code({ className }) {
  return (
    <Svg className={className}>
      <rect x="6" y="16" width="108" height="88" rx="22" fill="#3DD6B5" />
      <path d="M42 38 L22 60 L42 82" fill="none" strokeWidth="7" />
      <path d="M78 38 L98 60 L78 82" fill="none" strokeWidth="7" />
      <path d="M67 32 L53 88" fill="none" strokeWidth="7" />
    </Svg>
  );
}

export function Bulb({ className }) {
  return (
    <Svg className={className}>
      <path d="M60 16 C36 16 26 36 32 54 C36 65 46 70 46 82 L74 82 C74 70 84 65 88 54 C94 36 84 16 60 16 Z" fill="#FFC93C" />
      <rect x="46" y="84" width="28" height="16" rx="5" fill="#B9C3E8" />
      <path d="M52 60 L60 50 L68 60" fill="none" />
      <line x1="60" y1="2" x2="60" y2="8" />
      <line x1="20" y1="20" x2="26" y2="25" />
      <line x1="100" y1="20" x2="94" y2="25" />
    </Svg>
  );
}

export function Sparkle({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <path d="M20 0 C22 14 26 18 40 20 C26 22 22 26 20 40 C18 26 14 22 0 20 C14 18 18 14 20 0 Z" fill="#FFC93C" />
    </svg>
  );
}

export function Wave({ className, flip = false }) {
  return (
    <svg className={className} viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path
        d={flip
          ? 'M0 40 C180 80 360 0 540 40 S900 80 1080 40 S1440 0 1440 40 L1440 0 L0 0 Z'
          : 'M0 40 C180 0 360 80 540 40 S900 0 1080 40 S1440 80 1440 40 L1440 80 L0 80 Z'}
      />
    </svg>
  );
}
