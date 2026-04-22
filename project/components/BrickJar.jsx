// Pick-A-Brick wall "bowl" — circular dish inset into a white tile,
// filled with many tiny 1x1 brick granules (matches the real LEGO store wall).

function BrickJar({ color, count, max = 120, name, onClick }) {
  const fill = Math.min(1, Math.log(1 + count) / Math.log(1 + Math.max(max, 20)));

  // bowl geometry (viewBox 120x120)
  const cx = 60, cy = 58, r = 44;

  // Scatter lots of tiny brick ellipses inside the bowl to simulate loose bricks.
  // Use a deterministic pseudo-random so SSR / re-renders are stable per count.
  function prng(seed) {
    let s = seed | 0;
    return () => {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 10000) / 10000;
    };
  }

  const brickCount = Math.max(18, Math.min(260, Math.round(40 + fill * 220)));
  const rand = prng((count * 9301 + 49297) || 1);

  const bricks = [];
  for (let i = 0; i < brickCount; i++) {
    // polar sampling weighted to the bottom of the bowl
    const t = rand(); // 0..1 fill progress
    const depth = Math.pow(rand(), 0.7); // 0 top..1 bottom
    const effectiveFill = fill;
    // keep bricks within fill line
    if (depth > effectiveFill + 0.05 && rand() > 0.2) continue;
    const ang = rand() * Math.PI - Math.PI; // bottom half
    const rr = r * 0.86 * Math.sqrt(rand());
    const bx = cx + Math.cos(ang) * rr * 0.95;
    // bias Y downward
    const by = cy + Math.abs(Math.sin(ang)) * rr * 0.95 - (1 - depth) * r * 0.2;
    // reject if above fill line
    const topY = cy + r - fill * r * 1.9;
    if (by < topY) continue;
    const w = 3.5 + rand() * 2.2;
    const h = 2.2 + rand() * 1.2;
    const rot = (rand() - 0.5) * 60;
    bricks.push({ x: bx, y: by, w, h, rot, key: i });
  }

  const darker = shade(color, -0.28);
  const lighter = shade(color, 0.22);

  const uid = React.useId ? React.useId() : 'b' + Math.random().toString(36).slice(2, 8);

  return (
    <button className="jar" onClick={onClick} title={`${name}: ${count} bricks`}>
      <svg className="jar-svg" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id={`tile-${uid}`} cx="0.5" cy="0.4" r="0.65">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#EDEDED" />
          </radialGradient>
          <radialGradient id={`bowl-${uid}`} cx="0.5" cy="0.35" r="0.7">
            <stop offset="0" stopColor="rgba(0,0,0,0.05)" />
            <stop offset="0.7" stopColor="rgba(0,0,0,0.18)" />
            <stop offset="1" stopColor="rgba(0,0,0,0.35)" />
          </radialGradient>
          <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="0.4" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.22)" />
          </linearGradient>
          <clipPath id={`bowlclip-${uid}`}>
            <circle cx={cx} cy={cy} r={r - 2} />
          </clipPath>
        </defs>

        {/* White tile background */}
        <rect x="2" y="2" width="116" height="116" rx="6"
              fill={`url(#tile-${uid})`} stroke="#E4E4E4" />
        {/* panel seams */}
        <line x1="2" y1="60" x2="118" y2="60" stroke="#E9E9E9" strokeWidth="0.5" />

        {/* bowl rim shadow (outer ring) */}
        <circle cx={cx} cy={cy} r={r + 3} fill="#D9D9D9" />
        <circle cx={cx} cy={cy} r={r + 1.5} fill="#F2F2F2" />

        {/* bowl inner (dark) */}
        <circle cx={cx} cy={cy} r={r} fill={darker} />
        <circle cx={cx} cy={cy} r={r} fill={`url(#bowl-${uid})`} />

        {/* bricks inside */}
        <g clipPath={`url(#bowlclip-${uid})`}>
          {/* base fill color pool */}
          <ellipse cx={cx} cy={cy + r - fill * r * 1.9 / 2}
                   rx={r - 3}
                   ry={Math.max(0.5, fill * r * 0.95)}
                   fill={color} opacity="0.95" />
          {bricks.map((b) => (
            <g key={b.key} transform={`translate(${b.x} ${b.y}) rotate(${b.rot})`}>
              <rect x={-b.w/2} y={-b.h/2} width={b.w} height={b.h} rx="0.6"
                    fill={color} stroke={darker} strokeWidth="0.3" />
              <rect x={-b.w/2 + 0.3} y={-b.h/2 + 0.2} width={b.w - 0.6} height={0.5}
                    fill={lighter} opacity="0.8" />
            </g>
          ))}
        </g>

        {/* glass highlight over bowl */}
        <ellipse cx={cx - 10} cy={cy - 14} rx="22" ry="8" fill="rgba(255,255,255,0.35)" />
        <circle cx={cx} cy={cy} r={r} fill={`url(#glass-${uid})`} pointerEvents="none" />
        {/* rim highlight */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2"
                strokeDasharray="60 300" transform={`rotate(-30 ${cx} ${cy})`} />

        {/* label strip at bottom */}
        <rect x="20" y="102" width="80" height="12" rx="2" fill="#FFFFFF" stroke="#E4E4E4" />
        <rect x="20" y="102" width="3" height="12" fill={color} />
        <text x="27" y="110.5" fontFamily="Google Sans Flex, sans-serif" fontSize="6" fontWeight="700" fill="#181D27">
          {count.toLocaleString()}
        </text>
        <text x="95" y="110.5" textAnchor="end" fontFamily="Google Sans Flex, sans-serif" fontSize="5" fontWeight="600" fill="#717680">
          BRICKS
        </text>
      </svg>
      <div className="jar-label">
        <span className="jar-name"><span className="jar-swatch" style={{background: color}} /> {name}</span>
        <span className="jar-count">{count}</span>
      </div>
    </button>
  );
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  }
  return `rgb(${r},${g},${b})`;
}

window.BrickJar = BrickJar;
