// L3: Huffman coding. A hand-written binary min-heap builds the optimal
// prefix-code tree, the text is encoded to real bits, then those bits are
// decoded back to prove the round trip is lossless. No libraries involved.
import { $, $$, el, cssVar, onThemeChange } from '../util.js';

const MAX_BITS_SHOWN = 640;

export class MinHeap {
  constructor() {
    this.items = [];
  }
  get size() {
    return this.items.length;
  }
  // Ties break on insertion order so the tree (and codes) are deterministic
  less(a, b) {
    return a.freq < b.freq || (a.freq === b.freq && a.order < b.order);
  }
  push(node) {
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(items[i], items[parent])) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let min = i;
        if (l < items.length && this.less(items[l], items[min])) min = l;
        if (r < items.length && this.less(items[r], items[min])) min = r;
        if (min === i) break;
        [items[i], items[min]] = [items[min], items[i]];
        i = min;
      }
    }
    return top;
  }
}

export function buildTree(freq) {
  const heap = new MinHeap();
  let order = 0;
  for (const [char, f] of freq) heap.push({ char, freq: f, order: order++ });
  // One distinct symbol still needs a 1-bit code, so give it a parent
  if (heap.size === 1) return { freq: heap.items[0].freq, left: heap.pop(), order };
  while (heap.size > 1) {
    const left = heap.pop();
    const right = heap.pop();
    heap.push({ freq: left.freq + right.freq, left, right, order: order++ });
  }
  return heap.pop();
}

const isLeaf = (n) => !n.left && !n.right;

export function buildCodes(node, prefix = '', codes = new Map()) {
  if (isLeaf(node)) codes.set(node.char, prefix || '0');
  else {
    if (node.left) buildCodes(node.left, `${prefix}0`, codes);
    if (node.right) buildCodes(node.right, `${prefix}1`, codes);
  }
  return codes;
}

export function decode(bits, root) {
  let out = '';
  let node = root;
  for (const bit of bits) {
    node = bit === '0' ? node.left : node.right;
    if (isLeaf(node)) {
      out += node.char;
      node = root;
    }
  }
  return out;
}

const show = (ch) => (ch === ' ' ? '␣' : ch === '\n' ? '↵' : ch === '\t' ? '⇥' : ch);

export function init(panel) {
  const input = $('#hufInput', panel);
  const statsEl = $('#hufStats', panel);
  const meter = $('#hufMeter', panel);
  const tableBody = $('#hufTable', panel);
  const bitsEl = $('#hufBits', panel);
  const verifyEl = $('#hufVerify', panel);
  const canvas = $('#hufTree', panel);
  const out = $('#hufOut', panel);
  const ctx = canvas.getContext('2d');

  let tree = null;
  let hotChar = null;

  function stat(label, value, accent) {
    return el('div', { class: 'stat' }, el('span', { class: 'stat-label', text: label }), el('span', { class: `stat-value${accent ? ' is-accent' : ''}`, text: value }));
  }

  function run() {
    const text = input.value;
    if (!text) {
      out.hidden = true;
      tree = null;
      return;
    }
    out.hidden = false;

    const freq = new Map();
    for (const ch of text) freq.set(ch, (freq.get(ch) || 0) + 1);
    tree = buildTree(freq);
    const codes = buildCodes(tree);
    const chars = [...text];
    const bits = chars.map((ch) => codes.get(ch)).join('');
    const ok = decode(bits, tree) === text;

    const original = chars.length * 8;
    const ratio = bits.length / original;
    const avg = bits.length / chars.length;
    statsEl.replaceChildren(
      stat('ASCII size', `${original} b`),
      stat('Huffman size', `${bits.length} b`),
      stat('Bits / char', avg.toFixed(2)),
      stat('Saved', `${((1 - ratio) * 100).toFixed(1)}%`, true)
    );
    meter.style.width = `${(ratio * 100).toFixed(1)}%`;

    tableBody.replaceChildren(
      ...[...codes.entries()]
        .sort((a, b) => freq.get(b[0]) - freq.get(a[0]) || a[1].length - b[1].length)
        .map(([ch, code]) =>
          el(
            'tr',
            { onmouseenter: () => setHot(ch), onmouseleave: () => setHot(null) },
            el('td', { text: show(ch) }),
            el('td', { text: freq.get(ch) }),
            el('td', { text: code })
          )
        )
    );

    // One span per encoded character, alternating shade so code boundaries are visible
    let shown = 0;
    const spans = [];
    for (const ch of chars) {
      if (shown >= MAX_BITS_SHOWN) break;
      const code = codes.get(ch);
      spans.push(el('span', { dataset: { ch }, text: code }));
      shown += code.length;
    }
    if (bits.length > shown) spans.push(el('span', { class: 'muted', text: ` … +${bits.length - shown} more bits` }));
    bitsEl.replaceChildren(...spans);
    setHot(hotChar);

    verifyEl.textContent = ok
      ? `✓ Decoded ${bits.length} bits back to your exact ${chars.length} characters.`
      : '✗ The decoded text didn’t match. That’s a bug!';
    verifyEl.classList.toggle('is-ok', ok);

    draw();
  }

  function setHot(ch) {
    hotChar = ch;
    $$('span[data-ch]', bitsEl).forEach((s) => s.classList.toggle('is-hot', ch != null && s.dataset.ch === ch));
    draw();
  }

  // Leaves spread evenly left to right; parents centred over their children
  function layout(root) {
    const pos = new Map();
    let leaf = 0;
    let leaves = 0;
    let depth = 0;
    (function count(n, d) {
      depth = Math.max(depth, d);
      if (isLeaf(n)) leaves++;
      else [n.left, n.right].forEach((c) => c && count(c, d + 1));
    })(root, 0);
    (function place(n, d) {
      if (isLeaf(n)) {
        const x = leaves === 1 ? 0.5 : leaf++ / (leaves - 1);
        pos.set(n, { x, d });
        return x;
      }
      const xs = [n.left, n.right].filter(Boolean).map((c) => place(c, d + 1));
      const x = xs.reduce((a, b) => a + b, 0) / xs.length;
      pos.set(n, { x, d });
      return x;
    })(root, 0);
    return { pos, depth };
  }

  function draw() {
    if (!tree) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const ink = cssVar('--ink');
    const muted = cssVar('--muted');
    const line = cssVar('--line-strong');
    const accent = cssVar('--accent');
    const bg = cssVar('--bg');
    const { pos, depth } = layout(tree);
    const padX = 18;
    const padY = 18;
    const P = (n) => {
      const p = pos.get(n);
      return {
        x: padX + p.x * (rect.width - padX * 2),
        y: padY + (depth ? p.d / depth : 0) * (rect.height - padY * 2),
      };
    };

    // Which nodes sit on the path to the hovered character?
    const hotPath = new Set();
    if (hotChar != null) {
      (function find(n) {
        if (isLeaf(n)) return n.char === hotChar && hotPath.add(n);
        const hit = [n.left, n.right].some((c) => c && find(c));
        if (hit) hotPath.add(n);
        return hit;
      })(tree);
    }

    ctx.lineWidth = 1.2;
    ctx.font = '10px "Geist Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    (function edges(n) {
      const a = P(n);
      [['left', '0'], ['right', '1']].forEach(([side, bit]) => {
        const child = n[side];
        if (!child) return;
        const b = P(child);
        const hot = hotPath.has(child);
        ctx.strokeStyle = hot ? accent : line;
        ctx.lineWidth = hot ? 2.2 : 1.2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = hot ? accent : muted;
        ctx.fillText(bit, (a.x + b.x) / 2 + (side === 'left' ? -7 : 7), (a.y + b.y) / 2 - 4);
        edges(child);
      });
    })(tree);

    const leafR = Math.max(7, Math.min(11, rect.width / (pos.size * 1.1)));
    pos.forEach((_, n) => {
      const p = P(n);
      const hot = hotPath.has(n);
      ctx.beginPath();
      if (isLeaf(n)) {
        ctx.arc(p.x, p.y, leafR, 0, Math.PI * 2);
        ctx.fillStyle = hot ? accent : ink;
        ctx.fill();
        ctx.fillStyle = bg;
        ctx.font = `600 ${Math.round(leafR * 1.05)}px "Geist Mono", monospace`;
        ctx.fillText(show(n.char), p.x, p.y + 0.5);
      } else {
        ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = hot ? accent : muted;
        ctx.fill();
      }
    });
  }

  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });
  $$('[data-huf-sample]', panel).forEach((btn) =>
    btn.addEventListener('click', () => {
      input.value = btn.dataset.hufSample;
      run();
    })
  );
  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(draw, 100);
  });
  onThemeChange(draw);

  run();
  return { shown: draw };
}
