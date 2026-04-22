// LEGO-style color palettes for the mosaic engine.
// "original" uses an expanded, accurate LEGO solid-color palette (~55 colors)
// sourced from the LEGO/BrickLink solid-brick list for perceptual accuracy.

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// sRGB → linear → XYZ → Lab (precomputed per palette entry so nearest-match is fast).
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function rgbToLab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  // D65
  let X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  let Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  X /= 0.95047; Y /= 1.0; Z /= 1.08883;
  const f = (t) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t) + 16 / 116;
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function P(name, hex) {
  const rgb = hexToRgb(hex);
  const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
  return { name, hex, rgb, lab };
}

const PALETTES = {
  // Expanded official-ish LEGO solid palette — whites → grays → blacks, reds, oranges,
  // yellows, browns/tans, greens, blues, purples, pinks. ~55 colors.
  original: [
    // Whites & grays & blacks
    P('White',              '#F4F4F4'),
    P('Very Light Bluish Gray','#E6E3DA'),
    P('Light Bluish Gray',  '#AFB5C7'),
    P('Light Gray',         '#9BA19D'),
    P('Sand Blue',          '#6C7B8A'),
    P('Dark Bluish Gray',   '#646464'),
    P('Dark Gray',          '#6D6E5C'),
    P('Very Dark Gray',     '#3B3B3B'),
    P('Black',              '#05131D'),

    // Reds, oranges, pinks
    P('Light Salmon',       '#FEBABD'),
    P('Coral',              '#F9B7A5'),
    P('Medium Nougat',      '#CC8E69'),
    P('Nougat',             '#D09168'),
    P('Light Flesh',        '#F6D7B3'),
    P('Bright Pink',        '#FC97AC'),
    P('Dark Pink',          '#E4ADC8'),
    P('Magenta',            '#923978'),
    P('Red',                '#C91A09'),
    P('Dark Red',           '#720E0F'),
    P('Bright Orange',      '#FE8A18'),
    P('Orange',             '#FFA70B'),
    P('Medium Orange',      '#FFA531'),
    P('Earth Orange',       '#A95500'),
    P('Dark Orange',        '#A83D15'),

    // Yellows, tans, browns
    P('Bright Light Yellow','#FFEC6C'),
    P('Yellow',             '#F2CD37'),
    P('Pearl Gold',         '#DCBE61'),
    P('Olive Green',         '#9B9A5A'),
    P('Dark Tan',           '#958A73'),
    P('Tan',                '#E4CD9E'),
    P('Medium Dark Flesh',  '#CC702A'),
    P('Reddish Brown',      '#582A12'),
    P('Dark Brown',         '#352100'),

    // Greens
    P('Yellowish Green',    '#DFEEA5'),
    P('Lime',               '#BBE90B'),
    P('Medium Lime',        '#C7D23C'),
    P('Bright Green',       '#4B9F4A'),
    P('Green',              '#237841'),
    P('Dark Green',         '#184632'),
    P('Sand Green',         '#A0BCAC'),
    P('Teal',               '#008F9B'),
    P('Dark Turquoise',     '#008F9B'),

    // Blues
    P('Light Aqua',         '#ADC3C0'),
    P('Aqua',               '#B3D7D1'),
    P('Medium Azure',       '#36AEBF'),
    P('Dark Azure',         '#078BC9'),
    P('Medium Blue',        '#6E99D2'),
    P('Blue',               '#0055BF'),
    P('Bright Blue',        '#0055BF'),
    P('Dark Blue',          '#0A3463'),
    P('Sand Blue Deep',     '#59788D'),

    // Purples & pinks
    P('Lavender',           '#CDA4DE'),
    P('Medium Lavender',    '#AC78BA'),
    P('Dark Purple',        '#3F3691'),
    P('Purple',             '#81007B'),
    P('Bright Pink Deep',   '#DF6695'),
  ],

  bw: [
    P('White',          '#FFFFFF'),
    P('Very Light Gray','#E1E1E1'),
    P('Light Gray',     '#BEBEBE'),
    P('Medium Gray',    '#8E8E8E'),
    P('Dark Gray',      '#5A5A5A'),
    P('Very Dark Gray', '#2E2E2E'),
    P('Black',          '#0A0A0A'),
  ],

  sepia: [
    P('Ivory',          '#FFF8E7'),
    P('Cream',          '#F2E3C4'),
    P('Sand',           '#D8BC8A'),
    P('Light Tan',      '#C19A6B'),
    P('Tan',            '#A6774A'),
    P('Warm Brown',     '#7A4E28'),
    P('Dark Brown',     '#4E2C12'),
    P('Deep Brown',     '#2A1608'),
  ],

  retro: [
    P('Cream',          '#FFF2C7'),
    P('Soft Peach',     '#FFC8A8'),
    P('Hot Pink',       '#FF4FA3'),
    P('Magenta',        '#C9237D'),
    P('Mustard',        '#F4B61F'),
    P('Tangerine',      '#FF7A1F'),
    P('Aqua',           '#3FD0D4'),
    P('Teal',           '#0F7A8F'),
    P('Electric Blue',  '#2D5BFF'),
    P('Violet',         '#7A5AF8'),
    P('Dark Purple',    '#3B1F7A'),
    P('Lime',           '#B6E43E'),
    P('Forest',         '#2E6B3B'),
    P('Cream Dark',     '#F0DFA8'),
    P('Charcoal',       '#1F2430'),
  ],

  pastel: [
    P('Cream',          '#FFF6E6'),
    P('Pale Pink',      '#FFD4DF'),
    P('Blush',          '#F7A6B4'),
    P('Peach',          '#FFCBA4'),
    P('Butter',         '#FFE9A8'),
    P('Mint',           '#BEEBD4'),
    P('Sky',            '#BFE3F0'),
    P('Sage',           '#C8D5B9'),
    P('Lavender',       '#D5CBEB'),
    P('Soft Gray',      '#E6E6EA'),
    P('Dusty Rose',     '#C58B90'),
    P('Warm Taupe',     '#A69082'),
  ],

  neon: [
    P('Neon Pink',      '#FF2E92'),
    P('Neon Magenta',   '#E600A5'),
    P('Neon Orange',    '#FF6A00'),
    P('Neon Yellow',    '#F6F800'),
    P('Neon Green',     '#39FF14'),
    P('Neon Cyan',      '#18E0FF'),
    P('Neon Blue',      '#1F4DFF'),
    P('Neon Purple',    '#A100FF'),
    P('Jet Black',      '#0A0A0A'),
    P('Soft White',     '#F5F5F5'),
  ],

  nature: [
    P('Bone',           '#F1ECDE'),
    P('Sand',           '#D8C79D'),
    P('Moss Light',     '#A4B572'),
    P('Moss',           '#6E8448'),
    P('Forest',         '#354E2B'),
    P('Leaf',           '#517B3B'),
    P('Bark',           '#6B4A2B'),
    P('Earth',          '#3E2A17'),
    P('Sky',            '#A4C8DB'),
    P('River',          '#2F6B8F'),
    P('Stone',          '#8C8A7F'),
    P('Slate',          '#4D4E4A'),
  ],

  monoRed: [
    P('Snow',           '#FFF4F4'),
    P('Blush',          '#F8C8C8'),
    P('Coral',          '#F18A8A'),
    P('Brick',          '#D94646'),
    P('Red',            '#C91A09'),
    P('Crimson',        '#9A0F0F'),
    P('Deep Red',       '#5C0808'),
    P('Black',          '#120505'),
  ],

  monoBlue: [
    P('Snow',           '#F4F8FF'),
    P('Ice',            '#CADFF4'),
    P('Sky',            '#7FAFDD'),
    P('Azure',          '#2E7EC7'),
    P('Blue',           '#0055BF'),
    P('Navy',           '#0A3463'),
    P('Midnight',       '#091A37'),
    P('Black',          '#050912'),
  ],

  candy: [
    P('Marshmallow',    '#FFF0F5'),
    P('Bubblegum',      '#FF7FB6'),
    P('Strawberry',     '#E3326E'),
    P('Cherry',         '#C8102E'),
    P('Lemon',          '#FFE248'),
    P('Tangerine',      '#FF8C2E'),
    P('Grape',          '#8E44AD'),
    P('Blueberry',      '#3F51B5'),
    P('Mint',           '#79E3B3'),
    P('Licorice',       '#1B1B1F'),
  ],
};

const PALETTE_META = {
  original:  { label: 'Original',   desc: 'Full LEGO palette' },
  bw:        { label: 'B&W',        desc: 'Grayscale' },
  sepia:     { label: 'Sepia',      desc: 'Vintage warm tones' },
  retro:     { label: 'Retro',      desc: '80s neon synthwave' },
  pastel:    { label: 'Pastel',     desc: 'Soft nursery tones' },
  neon:      { label: 'Neon',       desc: 'Electric pop' },
  nature:    { label: 'Earth',      desc: 'Outdoor & nature' },
  monoRed:   { label: 'Mono Red',   desc: 'Red monochrome' },
  monoBlue:  { label: 'Mono Blue',  desc: 'Blue monochrome' },
  candy:     { label: 'Candy',      desc: 'Sweet & punchy' },
};

function paletteFor(presetKey) { return PALETTES[presetKey] || PALETTES.original; }

// Perceptual nearest color using Lab Delta-E (simple ΔE76 — fast & good enough).
function nearestColor(r, g, b, palette) {
  const L = rgbToLab(r, g, b);
  let best = palette[0];
  let bestD = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i];
    const dL = L[0] - p.lab[0];
    const da = L[1] - p.lab[1];
    const db = L[2] - p.lab[2];
    const d = dL * dL + da * da + db * db;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

window.PALETTES = PALETTES;
window.PALETTE_META = PALETTE_META;
window.paletteFor = paletteFor;
window.nearestColor = nearestColor;
window.rgbToLab = rgbToLab;
