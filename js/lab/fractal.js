// L4: Fractal explorer. Raw WebGL with a hand-written GLSL fragment shader
// that runs smooth escape-time iteration for every pixel, every frame.
import { $, $$, cssVar, hexToRgb, onThemeChange, reducedMotion } from '../util.js';

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uCenter;
uniform float uZoom;
uniform float uMaxIter;
uniform float uJulia;
uniform vec2 uC;
uniform vec3 uA;
uniform vec3 uB;
uniform float uShift;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 p = uCenter + uv / uZoom;
  vec2 z = uJulia > 0.5 ? p : vec2(0.0);
  vec2 c = uJulia > 0.5 ? uC : p;

  float n = 0.0;
  for (int i = 0; i < 800; i++) {
    if (float(i) >= uMaxIter) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    if (dot(z, z) > 256.0) break;
    n += 1.0;
  }

  if (n >= uMaxIter) {
    gl_FragColor = vec4(0.02, 0.02, 0.018, 1.0);
    return;
  }

  // Continuous escape count, so bands blend instead of stair-stepping
  float sn = max(n - log2(log2(dot(z, z))) + 4.0, 0.0);
  // How close to the set this point is, on a log scale
  float b = clamp(log(sn + 1.0) / log(uMaxIter), 0.0, 1.0);
  float band = 0.5 + 0.5 * cos(6.2831 * (sn * 0.035 + uShift));
  vec3 col = mix(uB, uA, smoothstep(0.12, 0.72, b));
  col = mix(col, vec3(1.0, 0.93, 0.84), smoothstep(0.72, 1.0, b));
  col *= 0.78 + 0.22 * band;
  gl_FragColor = vec4(col, 1.0);
}
`;

const PRESETS = {
  mandelbrot: { julia: false, c: [0, 0], center: [-0.75, 0], zoom: 0.36 },
  'julia-spiral': { julia: true, c: [-0.7, 0.27015], center: [0, 0], zoom: 0.42 },
  'julia-rabbit': { julia: true, c: [-0.123, 0.745], center: [0, 0], zoom: 0.42 },
  'julia-feather': { julia: true, c: [0.285, 0.01], center: [0, 0], zoom: 0.42 },
};

export function init(panel) {
  const canvas = $('#frCanvas', panel);
  const hud = $('#frHud', panel);
  const gl = canvas.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
  if (!gl) {
    hud.textContent = 'WebGL isn’t available in this browser.';
    return {};
  }

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);

  // One oversized triangle covers the whole viewport
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = Object.fromEntries(
    ['uRes', 'uCenter', 'uZoom', 'uMaxIter', 'uJulia', 'uC', 'uA', 'uB', 'uShift'].map((n) => [n, gl.getUniformLocation(program, n)])
  );

  let colorA = [1, 0.35, 0.12];
  let colorB = [1, 0.7, 0.28];
  function readColors() {
    colorA = hexToRgb(cssVar('--accent')).map((v) => v / 255);
    colorB = [0.03, 0.03, 0.045]; // near-black, so the accent glows at the boundary
    requestDraw();
  }

  let preset = PRESETS.mandelbrot;
  let center = [...preset.center];
  let zoom = preset.zoom;
  let target = null; // for animated dives
  let shift = 0;
  let visible = false;

  const maxIter = () => Math.min(800, Math.round(120 + 60 * Math.log2(Math.max(1, zoom))));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
  }

  function render() {
    if (!canvas.getBoundingClientRect().width) return;
    resize();
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform2f(u.uCenter, center[0], center[1]);
    gl.uniform1f(u.uZoom, zoom);
    gl.uniform1f(u.uMaxIter, maxIter());
    gl.uniform1f(u.uJulia, preset.julia ? 1 : 0);
    gl.uniform2f(u.uC, preset.c[0], preset.c[1]);
    gl.uniform3f(u.uA, ...colorA);
    gl.uniform3f(u.uB, ...colorB);
    gl.uniform1f(u.uShift, shift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const z = zoom >= 1000 ? zoom.toExponential(1) : zoom.toFixed(zoom < 10 ? 2 : 0);
    hud.textContent = `${z}× · ${maxIter()} iterations · ${center[0].toFixed(5)}, ${center[1] >= 0 ? '+' : ''}${center[1].toFixed(5)}i`;
  }

  // Render on demand, plus a slow color drift while the panel is on screen
  let raf = 0;
  let dirty = true;
  function requestDraw() {
    dirty = true;
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0;
    if (!visible) return;
    if (target) {
      // Ease toward the dive target, zooming in log space
      center[0] += (target.center[0] - center[0]) * 0.12;
      center[1] += (target.center[1] - center[1]) * 0.12;
      zoom = Math.exp(Math.log(zoom) + (Math.log(target.zoom) - Math.log(zoom)) * 0.12);
      if (Math.abs(Math.log(target.zoom / zoom)) < 0.01) target = null;
      dirty = true;
    }
    if (!reducedMotion.matches) {
      shift += 0.0012;
      dirty = true;
    }
    if (dirty) {
      render();
      dirty = false;
    }
    if (target || !reducedMotion.matches) raf = requestAnimationFrame(tick);
  }

  // Canvas CSS pixels -> complex plane; mirrors the shader's math exactly
  function toComplex(px, py, rect) {
    return [center[0] + (px - rect.width / 2) / rect.height / zoom, center[1] + (rect.height / 2 - py) / rect.height / zoom];
  }

  function zoomAt(px, py, factor) {
    const rect = canvas.getBoundingClientRect();
    const before = toComplex(px, py, rect);
    zoom = Math.min(Math.max(zoom * factor, 0.15), 2e5);
    const after = toComplex(px, py, rect);
    center[0] += before[0] - after[0];
    center[1] += before[1] - after[1];
    target = null;
    requestDraw();
  }

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0018));
    },
    { passive: false }
  );

  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const point = toComplex(e.clientX - rect.left, e.clientY - rect.top, rect);
    target = { center: point, zoom: Math.min(zoom * (e.shiftKey ? 0.25 : 4), 2e5) };
    requestDraw();
  });

  // Drag to pan, two-finger pinch to zoom
  const pointers = new Map();
  let lastPinch = null;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lastPinch = null;
    target = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const rect = canvas.getBoundingClientRect();
    if (pointers.size === 1) {
      center[0] -= (e.clientX - prev.x) / rect.height / zoom;
      center[1] += (e.clientY - prev.y) / rect.height / zoom;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      requestDraw();
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (lastPinch) zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, dist / lastPinch);
    lastPinch = dist;
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    lastPinch = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  function applyPreset(key) {
    preset = PRESETS[key] || PRESETS.mandelbrot;
    center = [...preset.center];
    zoom = preset.zoom;
    target = null;
    requestDraw();
  }

  $$('#frPreset [role="radio"]', panel).forEach((btn, _, all) =>
    btn.addEventListener('click', () => {
      all.forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
      applyPreset(btn.dataset.preset);
    })
  );
  $('#frReset', panel).addEventListener('click', () => {
    center = [...preset.center];
    zoom = preset.zoom;
    target = null;
    requestDraw();
  });

  // Pause entirely when the canvas scrolls out of view
  new IntersectionObserver(([entry]) => {
    const wasVisible = visible;
    visible = entry.isIntersecting && !panel.hidden;
    if (visible && !wasVisible) requestDraw();
  }).observe(canvas);

  addEventListener('resize', requestDraw);
  onThemeChange(readColors);
  readColors();

  return {
    shown() {
      visible = true;
      requestDraw();
    },
    hidden() {
      visible = false;
    },
  };
}
