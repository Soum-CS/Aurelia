interface HotelArtProps {
  seed: number;
  className?: string;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  { skyTop: "#e9d5b3", skyBottom: "#d3a86f", shape: "#8a5a2b", accent: "#fdf6ea" },
  { skyTop: "#dfe3cd", skyBottom: "#aab884", shape: "#55613a", accent: "#f7f9ee" },
  { skyTop: "#d3e2df", skyBottom: "#87aca5", shape: "#3c5c55", accent: "#effaf7" },
  { skyTop: "#ecd7cb", skyBottom: "#cf9070", shape: "#7c3f26", accent: "#fbf1e9" },
  { skyTop: "#dcd7e6", skyBottom: "#9d92bd", shape: "#4d4070", accent: "#f4f1fa" },
];

export function HotelArt({ seed, className }: HotelArtProps) {
  const rand = mulberry32(seed * 9973 + 17);
  const palette = PALETTES[seed % PALETTES.length];
  const variant = seed % 3;

  const sunX = 160 + rand() * 480;
  const sunY = 120 + rand() * 100;
  const sunR = 42 + rand() * 26;

  const arches = Array.from({ length: 5 }, (_, i) => {
    const w = 96 + rand() * 36;
    const x = -20 + i * 172 + rand() * 24;
    const h = 200 + rand() * 130;
    return { x, w, h };
  });

  const towers = Array.from({ length: 7 }, () => ({
    w: 46 + rand() * 70,
    h: 110 + rand() * 230,
    gap: 12 + rand() * 30,
    lit: rand() > 0.5,
  }));

  let cursor = -30;

  return (
    <svg
      viewBox="0 0 820 560"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`sky-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.skyTop} />
          <stop offset="100%" stopColor={palette.skyBottom} />
        </linearGradient>
      </defs>
      <rect width="820" height="560" fill={`url(#sky-${seed})`} />
      <circle cx={sunX} cy={sunY} r={sunR} fill={palette.accent} opacity="0.95" />

      {variant === 0 &&
        arches.map((a, i) => (
          <g key={i}>
            <path
              d={`M ${a.x} 560 L ${a.x} ${560 - a.h} A ${a.w / 2} ${a.w / 2} 0 0 1 ${
                a.x + a.w
              } ${560 - a.h} L ${a.x + a.w} 560 Z`}
              fill={palette.shape}
            />
            <path
              d={`M ${a.x + a.w * 0.28} 560 L ${a.x + a.w * 0.28} ${
                560 - a.h + a.w * 0.22
              } A ${a.w / 5} ${a.w / 5} 0 0 1 ${a.x + a.w * 0.72} ${
                560 - a.h + a.w * 0.22
              } L ${a.x + a.w * 0.72} 560 Z`}
              fill={palette.accent}
              opacity="0.35"
            />
          </g>
        ))}

      {variant === 1 && (
        <>
          <path
            d={`M -40 430 Q 205 ${330 + rand() * 40} 450 420 T 880 400 L 880 560 L -40 560 Z`}
            fill={palette.shape}
            opacity="0.85"
          />
          <ellipse cx="410" cy="500" rx="520" ry="90" fill={palette.shape} opacity="0.5" />
          {[0, 1, 2].map((i) => (
            <path
              key={i}
              d={`M ${140 + i * 260} ${300 - i * 18} l 26 44 h -52 Z`}
              fill={palette.accent}
              opacity="0.7"
            />
          ))}
        </>
      )}

      {variant === 2 &&
        towers.map((t, i) => {
          const x = cursor;
          cursor += t.w + t.gap;
          if (x > 820) return null;
          return (
            <g key={i}>
              <rect x={x} y={560 - t.h} width={t.w} height={t.h} fill={palette.shape} />
              <rect
                x={x + t.w * 0.22}
                y={560 - t.h + 14}
                width={t.w * 0.56}
                height={t.h * 0.72}
                fill={palette.accent}
                opacity={t.lit ? 0.5 : 0.22}
              />
            </g>
          );
        })}

      <rect y="512" width="820" height="48" fill={palette.shape} opacity="0.9" />
    </svg>
  );
}
