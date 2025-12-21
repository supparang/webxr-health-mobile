// === /herohealth/vr/postfx-canvas.js ===
// Canvas PostFX Overlay (procedural) — safe for DOM targets/particles
// - STRONG chromatic edge split (red/cyan) tuned for Hydration
// - storm speedlines + stronger wobble
// - device-tilt reactive shimmer (optional; iOS permission on first tap)
// API: PostFXCanvas.init(opts), .setStorm(bool), .flash(type), .setStrength(x), .setParams(obj), .setEnabled(bool), .destroy()

(function (root) {
  'use strict';

  const DOC = root.document;
  if (!DOC) return;

  const PostFXCanvas = {};
  let canvas = null;
  let ctx = null;
  let raf = 0;

  // state
  let enabled = true;
  let storm = false;
  let strength = 1.0;

  let chroma = 0.95;
  let wobble = 0.70;
  let scan = 0.55;
  let vignette = 0.80;
  let speedlines = 0.85;

  let dpr = 1;
  let w = 0, h = 0;

  // tilt
  const tilt = { ok:false, x:0, y:0, rx:0, ry:0, cleanup:null };
  let tiltEnabled = true;

  // flash overlay
  let flashUntil = 0;
  let flashType = 'good';
  const FLASH_MS = 120;

  function clamp(v, a, b) {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  }
  function now() {
    return (typeof performance !== 'undefined') ? performance.now() : Date.now();
  }

  function ensureCanvas(opts = {}) {
    if (canvas && canvas.isConnected) return canvas;

    canvas = DOC.createElement('canvas');
    canvas.id = opts.id || 'hvr-postfx-canvas';
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: String(opts.zIndex ?? 46),
      opacity: String(opts.opacity ?? 1),
      mixBlendMode: opts.blendMode || 'screen'
    });

    DOC.body.appendChild(canvas);
    ctx = canvas.getContext('2d', { alpha: true });
    resize();
    return canvas;
  }

  function resize() {
    if (!canvas) return;
    dpr = clamp(root.devicePixelRatio || 1, 1, 3);
    const ww = Math.max(1, root.innerWidth || 1);
    const hh = Math.max(1, root.innerHeight || 1);
    w = Math.floor(ww * dpr);
    h = Math.floor(hh * dpr);
    canvas.width = w;
    canvas.height = h;
  }

  function setupTilt() {
    if (!tiltEnabled) return ()=>{};
    if (!('DeviceOrientationEvent' in root)) return ()=>{};

    const smooth = 0.90;
    const onOri = (e) => {
      const g = clamp(Number(e?.gamma ?? 0), -45, 45) / 45;
      const b = clamp(Number(e?.beta  ?? 0), -45, 45) / 45;
      tilt.rx = clamp(g, -1, 1);
      tilt.ry = clamp(b, -1, 1);
      tilt.x = tilt.x * smooth + tilt.rx * (1 - smooth);
      tilt.y = tilt.y * smooth + tilt.ry * (1 - smooth);
      tilt.ok = true;
    };

    root.addEventListener('deviceorientation', onOri, true);

    // iOS permission helper: first tap
    let permTap = null;
    try {
      const DOE = root.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        permTap = async () => {
          try {
            const res = await DOE.requestPermission();
            if (String(res).toLowerCase() === 'granted') {}
          } catch {}
          try {
            DOC.removeEventListener('pointerdown', permTap, true);
            DOC.removeEventListener('touchstart', permTap, true);
            DOC.removeEventListener('click', permTap, true);
          } catch {}
        };
        DOC.addEventListener('pointerdown', permTap, true);
        DOC.addEventListener('touchstart', permTap, true);
        DOC.addEventListener('click', permTap, true);
      }
    } catch {}

    return () => {
      try { root.removeEventListener('deviceorientation', onOri, true); } catch {}
      try {
        if (permTap) {
          DOC.removeEventListener('pointerdown', permTap, true);
          DOC.removeEventListener('touchstart', permTap, true);
          DOC.removeEventListener('click', permTap, true);
        }
      } catch {}
      tilt.ok = false;
    };
  }

  function clear() { ctx.clearRect(0, 0, w, h); }

  function drawScanlines(t) {
    const a = scan * strength * (storm ? 1.25 : 1.0);
    if (a <= 0.001) return;

    const step = Math.max(2, Math.floor(6 * dpr));
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    for (let y = 0; y < h; y += step) {
      const wave = 0.5 + 0.5 * Math.sin((y / (42 * dpr)) + t * (storm ? 7.8 : 4.9));
      const alpha = (0.012 + 0.026 * wave) * a;
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(4)})`;
      ctx.fillRect(0, y, w, 1 * dpr);
    }
    ctx.restore();
  }

  function drawVignette(t) {
    const a = vignette * strength * (storm ? 1.10 : 1.0);
    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';

    const sx = (tilt.ok ? tilt.x : 0) * 0.12;
    const sy = (tilt.ok ? tilt.y : 0) * 0.10;
    const cx = w * (0.5 + sx);
    const cy = h * (0.5 - sy);

    const r = Math.sqrt(w*w + h*h) * 0.55;
    const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    g.addColorStop(0, `rgba(0,0,0,0)`);
    g.addColorStop(1, `rgba(0,0,0,${(0.48 * a).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  }

  // ✅ Strong chromatic edge split (Hydration tuned)
  function drawChromaHint(t) {
    const a = chroma * strength * (storm ? 1.35 : 1.0);
    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // amplitude (more visible)
    const wig = (storm ? 1.45 : 1.0) * wobble * strength;
    const ox = (Math.sin(t * 2.10) * 18 + (tilt.ok ? tilt.x * 26 : 0)) * dpr * wig;
    const oy = (Math.cos(t * 1.85) * 14 + (tilt.ok ? -tilt.y * 20 : 0)) * dpr * wig;

    // --- 1) edge bands (left/right/top/bottom) -> make red/cyan split clearly visible
    // red/magenta edges
    const redA = (0.11 * a);
    ctx.fillStyle = `rgba(255,64,96,${redA.toFixed(3)})`;
    ctx.fillRect(0 + ox*0.55, 0, 10*dpr, h);                 // left
    ctx.fillRect(w - 10*dpr + ox*0.55, 0, 10*dpr, h);        // right
    ctx.fillRect(0, 0 + oy*0.55, w, 8*dpr);                  // top

    // cyan edges (opposite offset)
    const cyA = (0.12 * a);
    ctx.fillStyle = `rgba(80,230,255,${cyA.toFixed(3)})`;
    ctx.fillRect(0 - ox*0.55, 0, 10*dpr, h);
    ctx.fillRect(w - 10*dpr - ox*0.55, 0, 10*dpr, h);
    ctx.fillRect(0, h - 8*dpr - oy*0.55, w, 8*dpr);

    // --- 2) radial color separation (soft bloom) – Hydration palette
    // WATER CYAN glow
    let gC = ctx.createRadialGradient(w*0.60-ox, h*0.52-oy, 0, w*0.60-ox, h*0.52-oy, Math.max(w,h)*0.72);
    gC.addColorStop(0, `rgba(80,230,255,${(0.14*a).toFixed(3)})`);
    gC.addColorStop(1, `rgba(80,230,255,0)`);
    ctx.fillStyle = gC;
    ctx.fillRect(0,0,w,h);

    // RED split glow (stronger)
    let gR = ctx.createRadialGradient(w*0.40+ox, h*0.44+oy, 0, w*0.40+ox, h*0.44+oy, Math.max(w,h)*0.66);
    gR.addColorStop(0, `rgba(255,64,96,${(0.16*a).toFixed(3)})`);
    gR.addColorStop(1, `rgba(255,64,96,0)`);
    ctx.fillStyle = gR;
    ctx.fillRect(0,0,w,h);

    // GREEN accent (subtle, “hydration good”)
    let gG = ctx.createRadialGradient(w*0.52, h*0.20, 0, w*0.52, h*0.20, Math.max(w,h)*0.55);
    gG.addColorStop(0, `rgba(34,197,94,${(0.08*a).toFixed(3)})`);
    gG.addColorStop(1, `rgba(34,197,94,0)`);
    ctx.fillStyle = gG;
    ctx.fillRect(0,0,w,h);

    // --- 3) thin-film iridescence shimmer (reactive)
    // a light, moving rainbow-ish band; tilt nudges it
    const tx = (tilt.ok ? tilt.x : 0);
    const ty = (tilt.ok ? tilt.y : 0);
    const bandX = w*(0.50 + tx*0.18) + Math.sin(t*0.9)*w*0.06;
    const bandY = h*(0.32 - ty*0.16) + Math.cos(t*1.1)*h*0.05;
    let gI = ctx.createLinearGradient(bandX - w*0.35, bandY - h*0.15, bandX + w*0.35, bandY + h*0.15);
    const ia = (0.10 * a) * (storm ? 1.15 : 1.0);
    gI.addColorStop(0.00, `rgba(80,230,255,0)`);
    gI.addColorStop(0.35, `rgba(160,120,255,${ia.toFixed(3)})`);
    gI.addColorStop(0.55, `rgba(80,230,255,${(ia*0.85).toFixed(3)})`);
    gI.addColorStop(0.75, `rgba(34,197,94,${(ia*0.70).toFixed(3)})`);
    gI.addColorStop(1.00, `rgba(255,64,96,0)`);
    ctx.fillStyle = gI;
    ctx.fillRect(0,0,w,h);

    ctx.restore();
  }

  function drawSpeedlines(t) {
    const a = speedlines * strength * (storm ? 1.25 : 0.65);
    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const cx = w * 0.50;
    const cy = h * 0.52;
    const count = storm ? 54 : 26;
    const phase = t * (storm ? 11.8 : 6.6);

    for (let i=0;i<count;i++){
      const ang = (i / count) * Math.PI * 2 + Math.sin(phase*0.11 + i)*0.12;
      const len = (storm ? 0.66 : 0.45) * Math.max(w,h);

      const wob = (storm ? 1.05 : 0.75) * wobble * strength;
      const x1 = cx + Math.cos(ang) * (64*dpr + (Math.sin(phase + i)*20*dpr*wob));
      const y1 = cy + Math.sin(ang) * (64*dpr + (Math.cos(phase + i)*16*dpr*wob));
      const x2 = cx + Math.cos(ang) * len;
      const y2 = cy + Math.sin(ang) * len;

      const alpha = (0.012 + 0.026 * (0.5 + 0.5*Math.sin(phase + i))) * a;
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(4)})`;
      ctx.lineWidth = (storm ? 2.1 : 1.5) * dpr;
      ctx.beginPath();
      ctx.moveTo(x1,y1);
      ctx.lineTo(x2,y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawFlash() {
    if (!flashUntil) return;
    const tt = now();
    if (tt > flashUntil) { flashUntil = 0; return; }

    const left = flashUntil - tt;
    const p = clamp(left / FLASH_MS, 0, 1);
    const a = (0.26 + 0.32*(1-p)) * strength * (storm?1.15:1.0);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    let col = 'rgba(34,197,94,';     // good
    if (flashType === 'bad') col = 'rgba(239,68,68,';
    if (flashType === 'block') col = 'rgba(80,230,255,';  // hydration-cyan

    ctx.fillStyle = `${col}${a.toFixed(3)})`;
    ctx.fillRect(0,0,w,h);
    ctx.restore();
  }

  function applyCanvasTransform(t) {
    const base = wobble * strength * (storm ? 1.40 : 1.0);
    if (base <= 0.001) { canvas.style.transform = ''; return; }

    const wx = (Math.sin(t*2.7) * 1.25 + (tilt.ok ? tilt.x * 1.15 : 0)) * base;
    const wy = (Math.cos(t*2.3) * 1.12 + (tilt.ok ? -tilt.y * 0.95 : 0)) * base;
    const rot = (Math.sin(t*1.35) * 0.05) * base;

    canvas.style.transform = `translate3d(${wx.toFixed(2)}px, ${wy.toFixed(2)}px, 0) rotate(${rot.toFixed(3)}deg)`;
  }

  function frame(ts) {
    if (!enabled || !canvas || !ctx) return;
    const t = (ts || 0) * 0.001;

    applyCanvasTransform(t);

    clear();
    drawChromaHint(t);
    drawSpeedlines(t);
    drawScanlines(t);
    drawVignette(t);
    drawFlash();

    raf = root.requestAnimationFrame(frame);
  }

  // public API
  PostFXCanvas.init = function (opts = {}) {
    ensureCanvas(opts);

    if (opts.enabled != null) enabled = !!opts.enabled;
    if (opts.tiltEnabled != null) tiltEnabled = !!opts.tiltEnabled;

    if (opts.strength != null) strength = clamp(opts.strength, 0, 2.5);
    if (opts.chroma != null) chroma = clamp(opts.chroma, 0, 2.2);
    if (opts.wobble != null) wobble = clamp(opts.wobble, 0, 2.0);
    if (opts.scan != null) scan = clamp(opts.scan, 0, 2.0);
    if (opts.vignette != null) vignette = clamp(opts.vignette, 0, 2.0);
    if (opts.speedlines != null) speedlines = clamp(opts.speedlines, 0, 2.0);

    try { if (tilt.cleanup) tilt.cleanup(); } catch {}
    tilt.cleanup = setupTilt();

    root.addEventListener('resize', resize, { passive:true });
    if (!raf) raf = root.requestAnimationFrame(frame);
    return PostFXCanvas;
  };

  PostFXCanvas.setEnabled = function (on) {
    enabled = !!on;
    if (!enabled) {
      try { if (raf) root.cancelAnimationFrame(raf); } catch {}
      raf = 0;
      if (ctx) ctx.clearRect(0,0,w,h);
    } else {
      if (!raf) raf = root.requestAnimationFrame(frame);
    }
  };

  PostFXCanvas.setStorm = function (on) { storm = !!on; };

  PostFXCanvas.flash = function (type = 'good') {
    flashType = String(type || 'good');
    flashUntil = now() + FLASH_MS;
  };

  PostFXCanvas.setStrength = function (v) {
    strength = clamp(v, 0, 2.5);
  };

  PostFXCanvas.setParams = function (p = {}) {
    if (p.chroma != null) chroma = clamp(p.chroma, 0, 2.2);
    if (p.wobble != null) wobble = clamp(p.wobble, 0, 2.0);
    if (p.scan != null) scan = clamp(p.scan, 0, 2.0);
    if (p.vignette != null) vignette = clamp(p.vignette, 0, 2.0);
    if (p.speedlines != null) speedlines = clamp(p.speedlines, 0, 2.0);
  };

  PostFXCanvas.destroy = function () {
    enabled = false;
    try { if (raf) root.cancelAnimationFrame(raf); } catch {}
    raf = 0;

    try { root.removeEventListener('resize', resize); } catch {}
    try { if (tilt.cleanup) tilt.cleanup(); } catch {}
    tilt.cleanup = null;

    try { if (canvas) canvas.remove(); } catch {}
    canvas = null;
    ctx = null;
  };

  root.PostFXCanvas = PostFXCanvas;
})(typeof window !== 'undefined' ? window : globalThis);
