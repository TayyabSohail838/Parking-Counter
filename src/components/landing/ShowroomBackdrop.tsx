import s from "./landing.module.css";

/**
 * Background for the hero: a car showroom, heavily blurred like a shallow
 * depth-of-field photo.
 *
 * To use a real photo instead, put a licensed image at /public/hero/showroom.jpg
 * and set HERO_PHOTO below to "/hero/showroom.jpg".
 */
const HERO_PHOTO: string | null = null;

export function ShowroomBackdrop() {
  if (HERO_PHOTO) {
    return (
      <div className={s.backdrop} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HERO_PHOTO} alt="" className={s.backdropPhoto} />
        <div className={s.backdropShade} />
      </div>
    );
  }

  return (
    <div className={s.backdrop} aria-hidden>
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" className={s.backdropSvg}>
        <defs>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a4352" />
            <stop offset="1" stopColor="#59626f" />
          </linearGradient>
          <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9d5df" />
            <stop offset="0.55" stopColor="#aebccb" />
            <stop offset="1" stopColor="#8d9aa8" />
          </linearGradient>
          <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9aa3ad" />
            <stop offset="0.35" stopColor="#7c858f" />
            <stop offset="1" stopColor="#3f4650" />
          </linearGradient>
          <linearGradient id="ceiling" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d222b" />
            <stop offset="1" stopColor="#2c333e" />
          </linearGradient>
          <radialGradient id="lamp" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fffbe8" />
            <stop offset="1" stopColor="#fffbe8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3b5f9e" />
            <stop offset="1" stopColor="#1b2a4a" />
          </linearGradient>
        </defs>

        {/* ceiling + light strips */}
        <rect width="1600" height="260" fill="url(#ceiling)" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i} opacity={0.95 - i * 0.15}>
            <rect x={180 + i * 40} y={40 + i * 48} width={520 - i * 60} height={12 - i * 2} rx="6" fill="#f4f7ff" />
            <rect x={900 - i * 20} y={40 + i * 48} width={560 - i * 70} height={12 - i * 2} rx="6" fill="#f4f7ff" />
          </g>
        ))}
        {[260, 520, 780, 1040, 1300].map((x, i) => (
          <circle key={x} cx={x} cy={230 + (i % 2) * 6} r="38" fill="url(#lamp)" opacity="0.8" />
        ))}

        {/* back wall (left) with a large screen */}
        <rect x="0" y="250" width="900" height="300" fill="url(#wall)" />
        <rect x="80" y="300" width="300" height="170" rx="6" fill="url(#screen)" />
        <ellipse cx="230" cy="420" rx="95" ry="26" fill="#6b8ed1" opacity="0.8" />
        <rect x="430" y="330" width="420" height="220" fill="#4a5361" />
        <rect x="470" y="380" width="160" height="80" fill="#6b7480" opacity="0.6" />

        {/* glass wall (right) with trees outside */}
        <rect x="900" y="200" width="700" height="370" fill="url(#glass)" />
        <ellipse cx="1080" cy="470" rx="90" ry="80" fill="#6f8072" opacity="0.75" />
        <ellipse cx="1290" cy="460" rx="110" ry="90" fill="#62756a" opacity="0.7" />
        <ellipse cx="1500" cy="480" rx="100" ry="75" fill="#6f8072" opacity="0.7" />
        {[900, 1040, 1180, 1320, 1460, 1600].map((x) => (
          <rect key={x} x={x - 6} y="200" width="12" height="370" fill="#2c333d" />
        ))}
        <rect x="900" y="372" width="700" height="8" fill="#2c333d" />
        <rect x="860" y="180" width="60" height="400" fill="#252b34" />

        {/* glossy floor */}
        <rect x="0" y="550" width="1600" height="350" fill="url(#floor)" />
        <rect x="0" y="550" width="1600" height="6" fill="#c3cad2" opacity="0.6" />
        <rect x="960" y="560" width="600" height="160" fill="#cfd8e1" opacity="0.25" />

        {/* white SUV (left) */}
        <g>
          <ellipse cx="300" cy="770" rx="330" ry="34" fill="#20252c" opacity="0.55" />
          <path d="M-20 760 L-20 640 Q40 590 140 575 L260 520 Q340 500 470 505 L560 520 Q620 560 640 620 L650 700 Q650 760 600 765 Z"
            fill="#eef1f4" />
          <path d="M150 585 L270 535 Q340 518 450 522 L530 535 L560 590 Z" fill="#4a5462" />
          <rect x="560" y="640" width="70" height="22" rx="8" fill="#fdfdfd" />
          <circle cx="160" cy="760" r="62" fill="#1c2026" />
          <circle cx="160" cy="760" r="30" fill="#8a929c" />
          <circle cx="520" cy="760" r="58" fill="#1c2026" />
          <circle cx="520" cy="760" r="28" fill="#8a929c" />
        </g>

        {/* dark sedan (right) */}
        <g>
          <ellipse cx="1260" cy="745" rx="330" ry="30" fill="#14181e" opacity="0.6" />
          <path d="M930 735 L935 660 Q980 625 1080 612 L1170 565 Q1260 545 1380 552 L1470 580 Q1560 610 1600 650 L1600 735 Z"
            fill="#23272e" />
          <path d="M1095 612 L1180 572 Q1260 556 1370 562 L1440 588 L1450 612 Z" fill="#59626f" />
          <rect x="935" y="672" width="70" height="16" rx="6" fill="#dfe6ee" opacity="0.9" />
          <circle cx="1050" cy="738" r="50" fill="#0f1216" />
          <circle cx="1050" cy="738" r="24" fill="#5d6570" />
          <circle cx="1440" cy="738" r="50" fill="#0f1216" />
          <circle cx="1440" cy="738" r="24" fill="#5d6570" />
        </g>
      </svg>
      <div className={s.backdropShade} />
    </div>
  );
}
