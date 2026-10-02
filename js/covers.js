// Generative SVG cover art for each project, keyed by the `cover` field in
// data/projects.json. Seeded by title, so a project always gets the same art,
// and drawn with currentColor/CSS variables so it follows the theme.
import { seeded } from './util.js';

const W = 320;
const H = 200;

const ACCENT = 'var(--accent)';
const INK = 'var(--ink)';
const MUTED = 'var(--line-strong)';

// SVG presentation attributes don't reliably accept var() in every browser,
// so move any themed fill/stroke into a style attribute instead.
function themed(body) {
  return body.replace(/<(\w+)([^>]*?)(\/?)>/g, (tag, name, attrs, selfClose) => {
    const styles = [];
    const rest = attrs.replace(/\s(fill|stroke)="(var\([^"]+\))"/g, (_, prop, value) => {
      styles.push(`${prop}:${value}`);
      return '';
    });
    return styles.length ? `<${name}${rest} style="${styles.join(';')}"${selfClose}>` : tag;
  });
}

function svg(body) {
  body = themed(body);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${body}</svg>`;
}

// A small CNN diagram: input, conv layers, dense layer, output with the top class lit up
function neural(rand) {
  const layers = [6, 8, 8, 5, 7];
  const xs = layers.map((_, i) => 40 + i * 60);
  const nodes = layers.map((count, li) =>
    Array.from({ length: count }, (_, j) => ({
      x: xs[li],
      y: H / 2 + (j - (count - 1) / 2) * (150 / Math.max(count, 6)),
    }))
  );
  const winner = Math.floor(rand() * layers[layers.length - 1]);
  let out = '';
  for (let li = 0; li < nodes.length - 1; li++) {
    for (const a of nodes[li]) {
      for (const [bi, b] of nodes[li + 1].entries()) {
        if (rand() > 0.55) continue;
        const hot = li === nodes.length - 2 && bi === winner;
        out += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${hot ? ACCENT : MUTED}" stroke-opacity="${hot ? 0.9 : 0.8}" />`;
      }
    }
  }
  nodes.forEach((layer, li) =>
    layer.forEach((n, j) => {
      const last = li === nodes.length - 1;
      const hot = last && j === winner;
      out += `<circle cx="${n.x}" cy="${n.y}" r="${hot ? 6 : 3.6}" fill="${hot ? ACCENT : 'var(--bg)'}" stroke="${hot ? ACCENT : INK}" />`;
    })
  );
  return out;
}

// Concentric orbits with "donations" travelling inward toward a core
function orbits(rand) {
  const cx = W * 0.62;
  const cy = H * 0.5;
  let out = '';
  for (let i = 1; i <= 6; i++) {
    out += `<ellipse cx="${cx}" cy="${cy}" rx="${i * 26}" ry="${i * 17}" stroke="${MUTED}" />`;
  }
  for (let i = 0; i < 14; i++) {
    const ring = 1 + Math.floor(rand() * 6);
    const a = rand() * Math.PI * 2;
    const x = cx + Math.cos(a) * ring * 26;
    const y = cy + Math.sin(a) * ring * 17;
    const hot = i < 3;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${hot ? 4.5 : 2.6}" fill="${hot ? ACCENT : INK}" stroke="none" />`;
  }
  out += `<path d="M${cx} ${cy + 8} l-9 -9 a5.5 5.5 0 0 1 9 -6 a5.5 5.5 0 0 1 9 6 z" fill="${ACCENT}" stroke="none" />`;
  return out;
}

// A barcode being swept by a scanner beam, with a check-in tick
function barcode(rand) {
  let out = '';
  let x = 46;
  while (x < W - 46) {
    const w = 1 + Math.floor(rand() * 4);
    if (rand() > 0.35) {
      out += `<rect x="${x}" y="46" width="${w}" height="96" fill="${INK}" stroke="none" />`;
    }
    x += w + 1 + Math.floor(rand() * 3);
  }
  out += `<rect x="30" y="91" width="${W - 60}" height="2" fill="${ACCENT}" stroke="none" />`;
  out += `<rect x="30" y="80" width="${W - 60}" height="24" fill="${ACCENT}" fill-opacity="0.12" stroke="none" />`;
  out += `<text x="${W / 2}" y="166" text-anchor="middle" font-family="Geist Mono, monospace" font-size="11" fill="${INK}" stroke="none" letter-spacing="3">CHECKED IN ✓</text>`;
  return out;
}

// A layout grid with a few "components" placed on it: the site itself
function grid(rand) {
  let out = '';
  for (let x = 20; x < W; x += 20) out += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${MUTED}" stroke-opacity="0.6" />`;
  for (let y = 20; y < H; y += 20) out += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${MUTED}" stroke-opacity="0.6" />`;
  const blocks = [
    [40, 40, 140, 40, true],
    [40, 100, 80, 60, false],
    [140, 100, 140, 20, false],
    [140, 140, 60, 20, false],
    [200, 40, 80, 40, false],
  ];
  for (const [x, y, w, h, hot] of blocks) {
    out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${hot ? ACCENT : 'var(--bg)'}" stroke="${hot ? ACCENT : INK}" />`;
  }
  const cx = 230 + Math.floor(rand() * 30);
  out += `<path d="M${cx} 120 l0 26 l7 -6 l5 11 l5 -2 l-5 -11 l9 -1 z" fill="${INK}" stroke="var(--bg)" />`;
  return out;
}

const generators = { neural, orbits, barcode, grid };

export function coverSVG(project) {
  const gen = generators[project.cover] || grid;
  return svg(gen(seeded(project.title)));
}
