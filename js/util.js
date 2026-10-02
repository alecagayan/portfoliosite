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
    else if (key === 'html') node.innerHTML = value;
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

// Calls fn whenever the light/dark theme changes
export function onThemeChange(fn) {
  new MutationObserver(fn).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

let toastTimer;
export function toast(message) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-shown'), 2200);
}

// Opens a <dialog> and animates it in; closeDialog animates it out first.
export function openDialog(dialog) {
  if (dialog.open) return;
  dialog.showModal();
  requestAnimationFrame(() => dialog.classList.add('is-open'));
}

export function closeDialog(dialog) {
  if (!dialog.open || !dialog.classList.contains('is-open')) return;
  dialog.classList.remove('is-open');
  const done = () => dialog.open && dialog.close();
  if (reducedMotion.matches) return done();
  dialog.addEventListener('transitionend', done, { once: true });
  setTimeout(done, 500);
}

// Wire the usual dialog dismissals: backdrop click and Escape both animate out.
export function wireDialog(dialog) {
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDialog(dialog);
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closeDialog(dialog);
  });
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

// Deterministic PRNG so generated art looks the same on every visit
export function seeded(seedString) {
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
