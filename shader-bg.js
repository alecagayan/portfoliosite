// Hand-rolled WebGL background: a single fullscreen triangle, one fragment
// shader doing fractal value noise (domain-warped) to paint a slow, flowing
// aurora tinted with the site's accent colors. No three.js, no library -
// just raw WebGL1 and GLSL.
(() => {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;

  const gl =
    canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) ||
    canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vertexSrc = `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentSrc = `
    precision highp float;

    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uParty;

    // Value noise, seeded with a hash of the lattice point
    vec2 hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
            dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
        mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
            dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
        u.y);
    }

    // Fractal Brownian motion: several noise octaves summed together
    float fbm(vec2 p) {
      float value = 0.0;
      float amp = 0.5;
      for (int i = 0; i < 5; i++) {
        value += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
      }
      return value;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      vec2 p = uv * vec2(uResolution.x / uResolution.y, 1.0) * 3.0;

      float t = uTime * (0.05 + uParty * 0.35);
      vec2 mouseOffset = (uMouse - 0.5) * 0.4;

      // Domain warp: feed noise back into itself for a more organic flow
      vec2 warp = vec2(fbm(p + t + mouseOffset), fbm(p - t + mouseOffset));
      float n = fbm(p + warp * 1.5);

      vec3 flowColor = mix(uColorA, uColorB, clamp(n * 0.5 + 0.5, 0.0, 1.0));

      if (uParty > 0.01) {
        float hue = fract(uv.x + uv.y + uTime * 0.15);
        vec3 partyColor = 0.5 + 0.5 * cos(6.28318 * (hue + vec3(0.0, 0.33, 0.67)));
        flowColor = mix(flowColor, partyColor, uParty);
      }

      float vignette = smoothstep(1.1, 0.2, length(uv - 0.5) * 1.3);
      float alpha = clamp(n * 0.5 + 0.35, 0.0, 1.0) * vignette * (0.35 + uParty * 0.25);

      gl_FragColor = vec4(flowColor, alpha);
    }
  `;

  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  const vertexShader = compileShader(gl.VERTEX_SHADER, vertexSrc);
  const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentSrc);
  if (!vertexShader || !fragmentShader) return;

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  // A single triangle big enough to cover the whole viewport - cheaper than
  // a quad (no index buffer, no diagonal seam to worry about).
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, 'uResolution');
  const uTime = gl.getUniformLocation(program, 'uTime');
  const uMouse = gl.getUniformLocation(program, 'uMouse');
  const uColorA = gl.getUniformLocation(program, 'uColorA');
  const uColorB = gl.getUniformLocation(program, 'uColorB');
  const uParty = gl.getUniformLocation(program, 'uParty');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function hexToRgb01(hex) {
    const h = hex.trim().replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  let colorA = [0.486, 0.427, 0.98];
  let colorB = [0.706, 0.361, 1.0];
  function readThemeColors() {
    const styles = getComputedStyle(document.documentElement);
    colorA = hexToRgb01(styles.getPropertyValue('--accent'));
    colorB = hexToRgb01(styles.getPropertyValue('--accent-2'));
  }
  readThemeColors();

  // The theme toggle just flips a data-theme attribute - watch for that
  // instead of hooking into the theme-toggle click handler directly.
  new MutationObserver(readThemeColors).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  const mouse = { x: 0.5, y: 0.5 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX / window.innerWidth;
    mouse.y = 1.0 - e.clientY / window.innerHeight;
  });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  window.addEventListener('resize', resize);
  resize();

  // Easter egg: the same up-up-down-down gesture from before now drives the
  // shader's energy and color cycling instead of a separate particle system.
  let partyLevel = 0;
  let partyEndTime = 0;
  const konamiSequence = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown'];
  let konamiProgress = 0;
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    konamiProgress = key === konamiSequence[konamiProgress] ? konamiProgress + 1 : key === konamiSequence[0] ? 1 : 0;
    if (konamiProgress === konamiSequence.length) {
      konamiProgress = 0;
      partyEndTime = performance.now() + 6000;
    }
  });

  function drawFrame(t) {
    partyLevel = partyEndTime > performance.now() ? Math.min(1, partyLevel + 0.05) : Math.max(0, partyLevel - 0.02);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uResolution, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform3f(uColorA, colorA[0], colorA[1], colorA[2]);
    gl.uniform3f(uColorB, colorB[0], colorB[1], colorB[2]);
    gl.uniform1f(uParty, partyLevel);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  if (prefersReducedMotion) {
    drawFrame(0);
  } else {
    (function render(now) {
      drawFrame(now * 0.001);
      requestAnimationFrame(render);
    })(0);
  }
})();
