
(function() {
  const canvas = document.getElementById('shader-canvas-ANIMATION_22');

  // Sync the WebGL drawing-buffer size with the CSS-driven layout size.
  // This fires on initial layout and whenever the element is resized.
  function syncSize() {
    const w = canvas.clientWidth  || 1280;
    const h = canvas.clientHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }
  }
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(syncSize).observe(canvas);
  }
  syncSize();

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;
  const vs = `attribute vec2 a_position;
varying vec2 v_texCoord;
void main() {
  v_texCoord = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;
  const fs = `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
varying vec2 v_texCoord;

// , attractive, vibrant pastel multi-layer background animation
// Soft flowing candy rainbow waves, glowing hearts, floating sparkles, and playful bouncing orbs

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.55), sin(0.55), -sin(0.55), cos(0.55));
    for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.1 + vec2(10.0, 10.0);
        a *= 0.5;
    }
    return v;
}

// 2D Heart SDF for floating cute hearts
float sdHeart(vec2 p, float size) {
    p /= size;
    p.y += 0.35;
    p.x = abs(p.x);
    if (p.y + p.x > 1.0) {
        return sqrt(dot(p - vec2(0.25, 0.75), p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
    }
    return sqrt(max(dot(p - vec2(0.0, 1.0), p - vec2(0.0, 1.0)),
                    dot(p - 0.5 * max(p.x + p.y, 0.0), p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float t = u_time * 0.55;

    // Interactive mouse influence
    vec2 mouseNorm = (u_mouse / u_resolution - 0.5) * 0.5;
    uv += mouseNorm * 0.12;

    // Vibrant Kawaii Candy Palette
    vec3 colCandyPink   = vec3(1.00, 0.76, 0.88); // #ffc2e0
    vec3 colBubbleLilac = vec3(0.88, 0.80, 1.00); // #e0ccff
    vec3 colSkyMint     = vec3(0.78, 0.95, 0.98); // #c7f2fa
    vec3 colPeachMelon  = vec3(1.00, 0.88, 0.78); // #ffe0c7
    vec3 colSoftLavender= vec3(0.96, 0.94, 1.00); // #f5f0ff
    vec3 colVibrantRose = vec3(1.00, 0.45, 0.70); // #ff73b3
    vec3 colGoldenGlow  = vec3(1.00, 0.94, 0.60); // #fff099

    // Organic wavy flowing plasma streams
    vec2 q = vec2(fbm(uv * 1.5 + vec2(t * 0.15, -t * 0.1)),
                  fbm(uv * 1.5 + vec2(-t * 0.1, t * 0.18)));

    vec2 r = vec2(fbm(uv * 2.0 + 2.5 * q + vec2(2.4, 5.1) + t * 0.12),
                  fbm(uv * 2.0 + 2.5 * q + vec2(7.1, 1.3) - t * 0.15));

    float f = fbm(uv + 3.0 * r + vec2(t * 0.08, -t * 0.08));

    // Base background blend
    vec3 color = mix(colSoftLavender, colCandyPink, clamp(f * 1.2, 0.0, 1.0));
    color = mix(color, colBubbleLilac, clamp(length(q) * 0.8, 0.0, 1.0));
    color = mix(color, colSkyMint, clamp(length(r) * 0.7, 0.0, 1.0));
    color = mix(color, colPeachMelon, clamp(sin(f * 3.1415 + t) * 0.5 + 0.5, 0.0, 0.45));

    // Floating Glowing Kawaii Hearts
    for (int i = 0; i < 7; i++) {
        float fi = float(i);
        float speed = 0.22 + 0.12 * fract(fi * 0.317);
        float xOffset = sin(fi * 1.8 + t * 0.35) * 0.85;
        float yPos = mod(fi * 0.35 + t * speed, 2.4) - 1.2;
        vec2 heartPos = vec2(xOffset, yPos);
        vec2 hDelta = uv - heartPos;
        
        float angle = sin(t * 1.4 + fi) * 0.2;
        mat2 rotH = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        hDelta = rotH * hDelta;

        float hSize = 0.055 + 0.025 * sin(fi * 2.1);
        float dHeart = sdHeart(hDelta, hSize);

        float heartAlpha = smoothstep(0.008, -0.008, dHeart);
        float heartGlow = 0.015 / (abs(dHeart) + 0.035);

        vec3 heartCol = mix(colVibrantRose, colCandyPink, 0.5 + 0.5 * sin(fi + t));
        color = mix(color, heartCol, heartAlpha * 0.65);
        color += heartCol * heartGlow * 0.22;
    }

    // Floating Twinkling Stars / Sparkles
    for (int j = 0; j < 9; j++) {
        float fj = float(j);
        float starSpeed = 0.18 + 0.09 * fract(fj * 0.43);
        float sX = cos(fj * 2.4 + t * 0.25) * 0.9;
        float sY = mod(fj * 0.27 + t * starSpeed * 1.2, 2.2) - 1.1;
        vec2 starPos = vec2(sX, sY);
        vec2 sDelta = uv - starPos;

        float twinkle = pow(0.5 + 0.5 * sin(t * 3.5 + fj * 2.5), 3.0);
        float dStar = length(sDelta);
        float starGlow = 0.008 / (dStar * dStar + 0.003) * twinkle;

        float cross = max(0.0, 1.0 - abs(sDelta.x) * 45.0) * max(0.0, 1.0 - abs(sDelta.y) * 4.0)
                    + max(0.0, 1.0 - abs(sDelta.y) * 45.0) * max(0.0, 1.0 - abs(sDelta.x) * 4.0);

        color += colGoldenGlow * starGlow * 0.18;
        color += vec3(1.0, 0.95, 0.8) * cross * twinkle * 0.4;
    }

    float shimmer = sin(uv.x * 5.0 + uv.y * 3.0 + t * 1.8) * cos(uv.y * 6.0 - uv.x * 2.0 - t * 1.2);
    color += vec3(0.04, 0.02, 0.06) * smoothstep(0.3, 0.9, shimmer);

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
}`;
  function cs(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  const prog = gl.createProgram();
  gl.attachShader(prog, cs(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, cs(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(prog, 'a_position');
  gl.enableVertexAttribArray(pos);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');

  // u_mouse is in pixel coordinates matching u_resolution (ShaderToy convention).
  // Shaders that need normalized coords should use: u_mouse / u_resolution.
  let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
  window.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      const nx = (event.clientX - rect.left) / rect.width;
      const ny = 1.0 - (event.clientY - rect.top) / rect.height;
      mouse.x = nx * canvas.width;
      mouse.y = ny * canvas.height;
    }
  });

  function render(t) {
    if (typeof ResizeObserver === 'undefined') syncSize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, t * 0.001);
    if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
    if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }
  render(0);
})();
