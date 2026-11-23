// Generates src/theme-dark.css: dark-mode overrides for every hard-coded colour in the app CSS.
// Tokens (var(--...)) are switched in tokens.css; this file covers the literal colours that the
// light design uses (tints, borders, semantic text). Each colour keeps its hue and is re-lit
// according to its role (surface / text / border), so the light design stays the single source.
//
//   node scripts/build-dark-theme.mjs          (writes src/theme-dark.css)
//   node scripts/build-dark-theme.mjs --check  (exit 1 if the file is out of date)
import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'src');
const output = join(src, 'theme-dark.css');
const DARK = ":root[data-theme='dark']";

function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith('.css') &&
      !['tokens.css', 'theme-dark.css', 'theme-dark-manual.css'].includes(name)
      ? [path]
      : [];
  });
}

// ---------------------------------------------------------------- colour maths (HSL)
function parseHex(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}
function toHsl({ r, g, b }) {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === R
      ? ((G - B) / d + (G < B ? 6 : 0)) / 6
      : max === G
        ? ((B - R) / d + 2) / 6
        : ((R - G) / d + 4) / 6;
  return { h, s, l };
}
function fromHsl({ h, s, l }) {
  const f = (p, q, t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: f(p, q, h + 1 / 3) * 255, g: f(p, q, h) * 255, b: f(p, q, h - 1 / 3) * 255 };
}
const hex2 = (v) =>
  Math.round(Math.max(0, Math.min(255, v)))
    .toString(16)
    .padStart(2, '0');
function toHex({ r, g, b }, a) {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}${a < 1 ? hex2(a * 255) : ''}`;
}

/** Re-light one colour for its role. Hue is kept; surfaces get a faint tint of it. */
function darken(colour, role) {
  const rgb = colour === 'white' ? { r: 255, g: 255, b: 255, a: 1 } : parseHex(colour);
  // Pure white surfaces are the card colour: follow the token exactly.
  if (role === 'surface' && rgb.r === 255 && rgb.g === 255 && rgb.b === 255)
    return 'var(--surface)';
  const hsl = toHsl(rgb);
  let { h, s, l } = hsl;
  if (role === 'surface') {
    if (l >= 0.6) {
      // light tint -> deep tinted surface (white = base card colour)
      l = 0.1 + (1 - l) * 0.6;
      s = Math.min(s, 0.55) * 0.6;
      if (s < 0.05) {
        h = 0.6; // neutral greys pick up the slate base hue
        s = 0.4;
      }
    } else if (l < 0.25) {
      l = 0.82 - l; // very dark fills (rare) become light
    }
  } else if (role === 'border') {
    if (l >= 0.6) {
      l = 0.16 + (1 - l) * 0.45;
      s = Math.min(s, 0.4) * 0.7 || 0.25;
      if (hsl.s < 0.05) h = 0.6;
    } else {
      l = Math.min(0.78, l + 0.25);
    }
  } else {
    // text, icons, strokes: dark ink -> light ink, saturated colours -> lighter same hue
    if (l < 0.6) {
      l = 0.93 - l * 0.55;
      if (s > 0.15) s = Math.min(1, s * 1.05);
    } else if (l >= 0.9 && rgb.a === 1) {
      return colour; // white text on coloured buttons stays white
    }
  }
  if (rgb.a < 1 && role === 'shadow') return `#000000${hex2(Math.min(1, rgb.a * 3) * 255)}`;
  return toHex(fromHsl({ h, s, l }), rgb.a);
}

const COLOUR = /#[0-9a-fA-F]{3,8}\b|\bwhite\b/g;
function roleOf(property) {
  if (/shadow/.test(property)) return 'shadow';
  if (/^(background|background-color|background-image)$/.test(property)) return 'surface';
  if (
    /^(border|border-(top|right|bottom|left)(-color)?|border-color|outline(-color)?)$/.test(
      property,
    )
  )
    return 'border';
  if (/^(color|fill|stroke|caret-color|text-decoration-color|accent-color)$/.test(property))
    return property === 'fill' ? 'fill' : 'ink';
  return null;
}

function convertValue(property, value) {
  const role = roleOf(property);
  if (!role || !COLOUR.test(value)) return null;
  COLOUR.lastIndex = 0;
  return value.replace(COLOUR, (match) => {
    if (role === 'fill') {
      const { l } = toHsl(parseHex(match === 'white' ? '#ffffff' : match));
      return darken(match, l >= 0.75 ? 'surface' : 'ink');
    }
    if (role === 'shadow') return darken(match, 'shadow');
    return darken(match, role);
  });
}

// ---------------------------------------------------------------- minimal CSS walker
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function walk(css, emit, wrappers = []) {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (prelude.startsWith('@media') || prelude.startsWith('@supports')) {
      walk(body, emit, [...wrappers, prelude]);
    } else if (!prelude.startsWith('@')) {
      emit(prelude, body, wrappers);
    }
    i = j;
  }
}

function darkSelector(selector) {
  return selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith(':root')) return DARK + part.slice(5);
      if (/^(html|body)\b/.test(part)) return `${DARK} ${part.replace(/^html\s*/, '')}`.trim();
      return `${DARK} ${part}`;
    })
    .join(',\n');
}

const blocks = [];
for (const file of cssFiles(src).sort()) {
  const rules = [];
  walk(stripComments(readFileSync(file, 'utf8')), (selector, body, wrappers) => {
    const declarations = [];
    for (const declaration of body.split(';')) {
      const colon = declaration.indexOf(':');
      if (colon < 0) continue;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (property.startsWith('--')) continue;
      const converted = convertValue(property, value);
      if (converted && converted !== value) declarations.push(`  ${property}: ${converted};`);
    }
    if (!declarations.length) return;
    let rule = `${darkSelector(selector)} {\n${declarations.join('\n')}\n}`;
    for (const wrapper of [...wrappers].reverse()) {
      rule = `${wrapper} {\n${rule.replace(/^/gm, '  ')}\n}`;
    }
    rules.push(rule);
  });
  if (rules.length) {
    blocks.push(`/* ${relative(src, file).replaceAll('\\', '/')} */\n${rules.join('\n')}`);
  }
}

const text = `/* GENERATED by scripts/build-dark-theme.mjs — do not edit by hand.
   Dark-mode overrides for literal colours in the light stylesheets. Token-based colours
   switch in tokens.css; hand-tuned dark rules live in theme-dark-manual.css. */
${blocks.join('\n\n')}
`;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(output, 'utf8');
  } catch {
    /* missing */
  }
  if (current.replace(/\r\n/g, '\n') !== text) {
    console.error('src/theme-dark.css is out of date: run node scripts/build-dark-theme.mjs');
    process.exit(1);
  }
  console.log('theme-dark.css is up to date');
} else {
  writeFileSync(output, text);
  console.log(
    `Wrote ${relative(root, output)} (${blocks.length} files, ${text.split('\n').length} lines)`,
  );
}
