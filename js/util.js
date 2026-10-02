// Small shared helpers. Nothing here touches the DOM at import time.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Tiny element factory: el('li', { class: 'x', text: 'hi' }, child1, child2)
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// Reads a CSS custom property off <html>, e.g. cssVar('--accent')
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Calls fn whenever the colors change: the toggle sets data-theme, the OS
// setting applies when no choice has been saved
export function onThemeChange(fn) {
  new MutationObserver(fn).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fn);
}

// Runs fn once, the first time `target` scrolls near the viewport
export function whenNear(target, fn, rootMargin = '200px') {
  if (!target) return;
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      fn();
    }
  }, { rootMargin });
  io.observe(target);
}
