// Hero background: a grid of dots that drift on a slow flow field and get
// pushed aside by the cursor. Plain canvas 2D, no libraries. It replaced a
// ~600KB three.js scene, and it pauses whenever the hero is off-screen.
import { cssVar, hexToRgb, onThemeChange, reducedMotion } from './util.js';

export function initField(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hero = canvas.parentElement;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let points = [];
  let ink = [0, 0, 0];
  let accent = [255, 90, 31];
  let party = false;
  let partyUntil = 0;

  const pointer = { x: -9999, y: -9999, active: false, sx: -9999, sy: -9999 };

  function readColors() {
    ink = hexToRgb(cssVar('--ink'));
    accent = hexToRgb(cssVar('--accent'));
  }

  function build() {
    const rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const gap = width < 640 ? 26 : 32;
    const cols = Math.ceil(width / gap) + 1;
    const rows = Math.ceil(height / gap) + 1;
    const offsetX = (width - (cols - 1) * gap) / 2;
    const offsetY = (height - (rows - 1) * gap) / 2;
    points = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = offsetX + c * gap;
        const y = offsetY + r * gap;
        points.push({ hx: x, hy: y, x, y, vx: 0, vy: 0 });
      }
    }
  }

  // Cheap smooth pseudo-noise: a few layered sines is plenty for drift
  function flow(x, y, t) {
    return (
      Math.sin(x * 0.006 + t * 0.45) * Math.cos(y * 0.008 - t * 0.35) +
      0.5 * Math.sin((x + y) * 0.004 + t * 0.6)
    );
  }

  function frame(time) {
    const t = time / 1000;
    ctx.clearRect(0, 0, width, height);

    // Ease the "lens" toward the pointer so it feels weighty
    pointer.sx += (pointer.x - pointer.sx) * 0.12;
    pointer.sy += (pointer.y - pointer.sy) * 0.12;

    const radius = Math.min(220, Math.max(140, width * 0.14));
    const r2 = radius * radius;
    if (party && t > partyUntil) party = false;

    for (const p of points) {
      const n = flow(p.hx, p.hy, t);
      const tx = p.hx + n * 6;
      const ty = p.hy + Math.cos(n * 2.4) * 6;

      // Spring toward the drifting home position
      p.vx += (tx - p.x) * 0.06;
      p.vy += (ty - p.y) * 0.06;

      // Push away from the pointer
      const dx = p.x - pointer.sx;
      const dy = p.y - pointer.sy;
      const d2 = dx * dx + dy * dy;
      let heat = 0;
      if (d2 < r2) {
        const d = Math.sqrt(d2) || 1;
        const force = (1 - d / radius) ** 2;
        p.vx += (dx / d) * force * 4.2;
        p.vy += (dy / d) * force * 4.2;
        heat = force;
      }

      p.vx *= 0.82;
      p.vy *= 0.82;
      p.x += p.vx;
      p.y += p.vy;

      const base = 0.13 + (n + 1.5) * 0.05;
      let color;
      if (party) {
        const hue = ((p.hx + p.hy) * 0.15 + t * 120) % 360;
        color = `hsla(${hue}, 90%, 60%, 0.75)`;
      } else if (heat > 0.02) {
        const a = Math.min(1, base + heat * 1.6);
        color = `rgba(${accent[0]}, ${accent[1]}, ${accent[2]}, ${a})`;
      } else {
        color = `rgba(${ink[0]}, ${ink[1]}, ${ink[2]}, ${base})`;
      }
      const size = 1.1 + heat * 2.6 + (party ? 1 : 0);
      ctx.fillStyle = color;
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
  }

  // --- lifecycle: only animate while visible -------------------------------
  let rafId = 0;
  let visible = true;
  function loop(time) {
    frame(time);
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (rafId || reducedMotion.matches) return;
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  function renderStatic() {
    frame(0);
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(hero);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (visible) start();
  });

  hero.addEventListener('pointermove', (e) => {
    const rect = hero.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
    if (!pointer.active) {
      pointer.sx = pointer.x;
      pointer.sy = pointer.y;
      pointer.active = true;
    }
  });
  hero.addEventListener('pointerleave', () => {
    pointer.x = pointer.y = -9999;
    pointer.active = false;
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      build();
      if (!rafId) renderStatic();
    }, 120);
  });

  onThemeChange(() => {
    readColors();
    if (!rafId) renderStatic();
  });

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) {
      stop();
      renderStatic();
    } else if (visible) start();
  });

  readColors();
  build();
  renderStatic();
  start();

  return {
    party(seconds = 6) {
      party = true;
      partyUntil = performance.now() / 1000 + seconds;
      if (!rafId) renderStatic();
    },
  };
}
