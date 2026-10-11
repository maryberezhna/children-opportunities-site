// Приклади «дитячих» ескізів образів для сторінки челенджу (11.10.2026,
// Марія: «там нема картинок, нема мотивації і не показано онлайн-галереї»).
// Це НЕ роботи дітей — малюнки команди, і на сторінці вони підписані
// «Приклад». Щойно в галереї зʼявляться справжні малюнки, приклади зникають.
// Ефект олівця — фільтр «тремтіння» ліній (feTurbulence + feDisplacementMap).

const INK = '#2b2b2b';

function Paper({ id, children, label }) {
  return (
    <svg viewBox="0 0 240 320" role="img" aria-label={label} className="ob-sketch">
      <defs>
        <filter id={`wob-${id}`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={id.length * 7} />
          <feDisplacementMap in="SourceGraphic" scale="3.2" />
        </filter>
        <pattern id={`hatch-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="240" height="320" fill="#fffdf7" />
      <g filter={`url(#wob-${id})`} strokeLinecap="round" strokeLinejoin="round">{children}</g>
    </svg>
  );
}

// Голова, шия, ноги — спільна «фігурка», на яку вдягаємо образ.
const Body = ({ legs = true }) => (
  <>
    <circle cx="120" cy="58" r="22" fill="#f6d2b5" stroke={INK} strokeWidth="3" />
    <path d="M110 56 q2 -3 4 0 M126 56 q2 -3 4 0 M112 68 q8 6 16 0" fill="none" stroke={INK} strokeWidth="2.5" />
    <path d="M115 79 v10 M125 79 v10" stroke={INK} strokeWidth="3" />
    {legs ? <path d="M108 236 v42 M132 236 v42" stroke={INK} strokeWidth="4" /> : null}
  </>
);

export function SketchRaincoat({ id = 'rain' }) {
  return (
    <Paper id={id} label="Приклад ескізу: жовтий дощовик і червоні гумові чоботи">
      <path d="M40 40 l-6 14 M70 20 l-6 14 M200 30 l-6 14 M180 90 l-6 14 M50 110 l-6 14 M205 150 l-6 14" stroke="#4a8fd6" strokeWidth="3" />
      <Body />
      <path d="M96 52 q24 -40 48 0 q4 18 -4 28 h-40 q-8 -10 -4 -28z" fill="#f5c518" stroke={INK} strokeWidth="3" />
      <circle cx="120" cy="62" r="18" fill="#f6d2b5" stroke={INK} strokeWidth="3" />
      <path d="M110 60 q2 -3 4 0 M126 60 q2 -3 4 0 M112 70 q8 6 16 0" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d="M100 88 h40 l26 150 h-92z" fill="#f5c518" stroke={INK} strokeWidth="3" />
      <path d="M100 88 h40 l26 150 h-92z" fill={`url(#hatch-${id})`} />
      <path d="M120 90 v146" stroke={INK} strokeWidth="2.5" />
      <circle cx="126" cy="120" r="3" fill={INK} /><circle cx="126" cy="150" r="3" fill={INK} /><circle cx="126" cy="180" r="3" fill={INK} />
      <path d="M100 92 l-22 70 M140 92 l22 70" stroke={INK} strokeWidth="3" fill="none" />
      <path d="M96 268 h26 v20 h-30 q-4 -10 4 -20z M118 268 h26 v20 h-30 q-4 -10 4 -20z" transform="translate(-8 0)" fill="#e2412b" stroke={INK} strokeWidth="3" />
    </Paper>
  );
}

export function SketchSweater({ id = 'sweater' }) {
  return (
    <Paper id={id} label="Приклад ескізу: помаранчевий светр із листям і зелена спідниця">
      <path d="M30 60 q10 -14 20 0 q-10 14 -20 0z M196 40 q10 -14 20 0 q-10 14 -20 0z M190 200 q10 -14 20 0 q-10 14 -20 0z" fill="#e85d24" stroke={INK} strokeWidth="2" />
      <Body />
      <path d="M92 92 q28 -10 56 0 l14 84 h-84z" fill="#e85d24" stroke={INK} strokeWidth="3" />
      <path d="M92 92 l-24 78 h16 l20 -56 M148 92 l24 78 h-16 l-20 -56" fill="#e85d24" stroke={INK} strokeWidth="3" />
      <path d="M104 120 q6 -8 12 0 q-6 8 -12 0z M128 140 q6 -8 12 0 q-6 8 -12 0z M106 156 q6 -8 12 0 q-6 8 -12 0z" fill="#f5c518" stroke={INK} strokeWidth="2" />
      <path d="M100 92 q20 14 40 0 l-4 14 q-16 8 -32 0z" fill="#3aa17e" stroke={INK} strokeWidth="2.5" />
      <path d="M134 104 l8 40 h-10z" fill="#3aa17e" stroke={INK} strokeWidth="2.5" />
      <path d="M80 176 h80 l14 62 h-108z" fill="#2f7d63" stroke={INK} strokeWidth="3" />
      <path d="M80 176 h80 l14 62 h-108z" fill={`url(#hatch-${id})`} />
      <path d="M98 280 h18 v8 h-22z M126 280 h18 v8 h-22z" fill="#5b3a29" stroke={INK} strokeWidth="3" />
    </Paper>
  );
}

export function SketchHoodie({ id = 'hoodie' }) {
  return (
    <Paper id={id} label="Приклад ескізу: бірюзове худі, джинси й кеди">
      <path d="M36 50 l6 12 l12 2 l-10 8 l3 12 l-11 -6 l-11 6 l3 -12 l-10 -8 l12 -2z" fill="#f5c518" stroke={INK} strokeWidth="2" />
      <path d="M190 210 l5 10 l10 2 l-8 7 l2 10 l-9 -5 l-9 5 l2 -10 l-8 -7 l10 -2z" fill="#f5c518" stroke={INK} strokeWidth="2" />
      <Body legs={false} />
      <path d="M94 88 q26 -12 52 0 l12 96 h-76z" fill="#1fa5a0" stroke={INK} strokeWidth="3" />
      <path d="M94 88 l-26 84 h16 l20 -60 M146 88 l26 84 h-16 l-20 -60" fill="#1fa5a0" stroke={INK} strokeWidth="3" />
      <path d="M102 150 h36 v22 h-36z" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d="M112 92 v22 M128 92 v22" stroke="#fff" strokeWidth="2.5" />
      <path d="M118 120 l3 -6 l3 6 l-3 6z" fill="#e85d24" stroke={INK} strokeWidth="1.5" />
      <path d="M84 184 h72 l-4 92 h-22 l-8 -70 l-8 70 h-22z" fill="#3b5ba5" stroke={INK} strokeWidth="3" />
      <path d="M84 184 h72 l-4 92 h-22 l-8 -70 l-8 70 h-22z" fill={`url(#hatch-${id})`} />
      <path d="M84 276 h30 v12 h-34z M124 276 h30 v12 h-34z" fill="#fff" stroke={INK} strokeWidth="3" />
      <path d="M80 286 h34 M120 286 h34" stroke="#e2412b" strokeWidth="3" />
    </Paper>
  );
}

export function SketchDress({ id = 'dress' }) {
  return (
    <Paper id={id} label="Приклад ескізу: бордова сукня з листям і капелюх">
      <path d="M200 70 q-30 0 -30 30 M200 70 q0 30 -30 30" fill="none" stroke="#e85d24" strokeWidth="3" />
      <Body />
      <ellipse cx="120" cy="40" rx="40" ry="8" fill="#5b3a29" stroke={INK} strokeWidth="3" />
      <path d="M100 40 q20 -30 40 0z" fill="#5b3a29" stroke={INK} strokeWidth="3" />
      <path d="M102 88 h36 l-4 56 l46 92 h-120 l46 -92z" fill="#a3324a" stroke={INK} strokeWidth="3" />
      <path d="M102 88 h36 l-4 56 l46 92 h-120 l46 -92z" fill={`url(#hatch-${id})`} />
      <path d="M102 92 l-20 62 M138 92 l20 62" stroke={INK} strokeWidth="3" fill="none" />
      <path d="M106 144 h28" stroke="#f5c518" strokeWidth="5" />
      <path d="M86 210 q6 -8 12 0 q-6 8 -12 0z M120 190 q6 -8 12 0 q-6 8 -12 0z M146 220 q6 -8 12 0 q-6 8 -12 0z" fill="#f5c518" stroke={INK} strokeWidth="2" />
      <path d="M100 280 h18 v8 h-22z M124 280 h18 v8 h-22z" fill={INK} />
    </Paper>
  );
}

export const EXAMPLES = [
  { key: 'rain', title: 'Дощовик для калюж', C: SketchRaincoat },
  { key: 'sweater', title: 'Светр з листям', C: SketchSweater },
  { key: 'hoodie', title: 'Худі на прогулянку', C: SketchHoodie },
  { key: 'dress', title: 'Сукня для свята', C: SketchDress },
];
