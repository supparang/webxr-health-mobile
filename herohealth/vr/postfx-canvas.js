// === /herohealth/vr/postfx-canvas.js ===
// Canvas PostFX Overlay (procedural) — safe for DOM targets/particles
// - scanlines + vignette + subtle chroma split hint
// - storm speedlines + stronger wobble
// - device-tilt reactive shimmer (optional; requests permission on iOS)
// API: PostFXCanvas.init(opts), .setStorm(bool), .flash(type), .setStrength(x), .setEnabled(bool), .destroy()

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
  let strength = 1.0;     // global intensity
  let chroma = 0.85;      // chroma hint intensity
  let wobble = 0.65;      // wobble intensity
  let scan = 0.55;        // scanline intensity
  let vignette = 0.75;    // vignette intensity
  let speedlines = 0.95;  // speedlines intensity

  let dpr = 1;
  let w = 0, h = 0;

  // tilt
  const tilt = { ok:false, x:0, y:0, rx:0, ry:0, cleanup:null };
  let tiltEnabled = true;

  // flash overlay
  let flashUntil = 0;
  let flashType = 'good'; // good/bad/block
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
      zIndex: String(opts.zIndex ?? 46),           // <= HUD(50), > targets(35)
      opacity: String(opts.opacity ?? 1),
      mixBlendMode: opts.blendMode || 'screen'     // safe overlay
    });

    // NOTE: do NOT set CSS filter here (avoid raster surprises)
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

    // iOS permission helper: tap once to request
    let permTap = null;
    try {
      const DOE = root.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        permTap = async () => {
          try {
            const res = await DOE.requestPermission();
            if (String(res).toLowerCase() === 'granted') {
              // ok
            }
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

  // ---------- drawing primitives ----------
  function clear() {
    ctx.clearRect(0, 0, w, h);
  }

  function drawScanlines(t) {
    const a = scan * strength * (storm ? 1.2 : 1.0);
    if (a <= 0.001) return;

    const step = Math.max(2, Math.floor(6 * dpr));
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    for (let y = 0; y < h; y += step) {
      // tiny wave to avoid flat pattern
      const wave = 0.5 + 0.5 * Math.sin((y / (42 * dpr)) + t * (storm ? 7.0 : 4.5));
      const alpha = (0.010 + 0.020 * wave) * a;
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(4)})`;
      ctx.fillRect(0, y, w, 1 * dpr);
    }
    ctx.restore();
  }

  function drawVignette(t) {
    const a = vignette * strength * (storm ? 1.08 : 1.0);
    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';

    // tilt-reactive center shift
    const sx = (tilt.ok ? tilt.x : 0) * 0.12;
    const sy = (tilt.ok ? tilt.y : 0) * 0.10;
    const cx = w * (0.5 + sx);
    const cy = h * (0.5 - sy);

    const r = Math.sqrt(w*w + h*h) * 0.55;
    const g = ctx.createRadialGradient(cx, cy, r * 0.35, cx, cy, r);
    g.addColorStop(0, `rgba(0,0,0,0)`);
    g.addColorStop(1, `rgba(0,0,0,${(0.46 * a).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.restore();
  }

  function drawChromaHint(t) {
    const a = chroma * strength * (storm ? 1.25 : 1.0);
    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // soft “chromatic split” impression: colored edge gradients
    const wig = (storm ? 1.6 : 1.0) * wobble * strength;
    const ox = (Math.sin(t * 1.9) * 14 + (tilt.ok ? tilt.x * 18 : 0)) * dpr * wig;
    const oy = (Math.cos(t * 1.7) * 10 + (tilt.ok ? -tilt.y * 14 : 0)) * dpr * wig;

    // red edge
    let g1 = ctx.createRadialGradient(w*0.35+ox, h*0.35+oy, 0, w*0.35+ox, h*0.35+oy, Math.max(w,h)*0.78);
    g1.addColorStop(0, `rgba(255,80,80,${(0.08*a).toFixed(3)})`);
    g1.addColorStop(1, `rgba(255,80,80,0)`);
    ctx.fillStyle = g1;
    ctx.fillRect(0,0,w,h);

    // cyan/blue edge
    let g2 = ctx.createRadialGradient(w*0.62-ox, h*0.58-oy, 0, w*0.62-ox, h*0.58-oy, Math.max(w,h)*0.82);
    g2.addColorStop(0, `rgba(90,220,255,${(0.10*a).toFixed(3)})`);
    g2.addColorStop(1, `rgba(90,220,255,0)`);
    ctx.fillStyle = g2;
    ctx.fillRect(0,0,w,h);

    // warm highlight
    let g3 = ctx.createRadialGradient(w*0.52, h*0.18, 0, w*0.52, h*0.18, Math.max(w,h)*0.55);
    g3.addColorStop(0, `rgba(255,240,140,${(0.06*a).toFixed(3)})`);
    g3.addColorStop(1, `rgba(255,240,140,0)`);
    ctx.fillStyle = g3;
    ctx.fillRect(0,0,w,h);

    ctx.restore();
  }

  function drawSpeedlines(t) {
    const a = speedlines * strength * (storm ? 1.2 : 0.55);
    if (a <= 0.001) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const cx = w * 0.50;
    const cy = h * 0.52;
    const count = storm ? 46 : 22;

    // moving phase
    const phase = t * (storm ? 10.5 : 6.0);

    for (let i=0;i<count;i++){
      const ang = (i / count) * Math.PI * 2 + Math.sin(phase*0.12 + i)*0.10;
      const len = (storm ? 0.64 : 0.42) * Math.max(w,h);
      const x2 = cx + Math.cos(ang) * len;
      const y2 = cy + Math.sin(ang) * len;

      const wob = (storm ? 1.0 : 0.7) * wobble * strength;
      const x1 = cx + Math.cos(ang) * (60*dpr + (Math.sin(phase + i)*18*dpr*wob));
      const y1 = cy + Math.sin(ang) * (60*dpr + (Math.cos(phase + i)*14*dpr*wob));

      const alpha = (0.010 + 0.020 * (0.5 + 0.5*Math.sin(phase + i))) * a;
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(4)})`;
      ctx.lineWidth = (storm ? 2.0 : 1.4) * dpr;
      ctx.beginPath();
      ctx.moveTo(x1,y1);
      ctx.lineTo(x2,y2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawFlash(t) {
    if (!flashUntil) return;
    const tt = now();
    if (tt > flashUntil) { flashUntil = 0; return; }

    const left = flashUntil - tt;
    const p = clamp(left / FLASH_MS, 0, 1);
    const a = (0.24 + 0.28*(1-p)) * strength * (storm?1.1:1.0);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    let col = 'rgba(34,197,94,'; // good
    if (flashType === 'bad') col = 'rgba(239,68,68,';
    if (flashType === 'block') col = 'rgba(96,165,250,';

    ctx.fillStyle = `${col}${a.toFixed(3)})`;
    ctx.fillRect(0,0,w,h);
    ctx.restore();
  }

  // wobble = transform canvas itself (safe)
  function applyCanvasTransform(t) {
    const base = wobble * strength * (storm ? 1.35 : 1.0);
    if (base <= 0.001) {
      canvas.style.transform = '';
      return;
    }

    const wx = (Math.sin(t*2.6) * 1.15 + (tilt.ok ? tilt.x * 1.0 : 0)) * base;
    const wy = (Math.cos(t*2.2) * 1.05 + (tilt.ok ? -tilt.y * 0.8 : 0)) * base;
    const rot = (Math.sin(t*1.3) * 0.04) * base;

    // CSS px, not dpr
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
    drawFlash(t);

    raf = root.requestAnimationFrame(frame);
  }

  // ---------- public API ----------
  PostFXCanvas.init = function (opts = {}) {
    ensureCanvas(opts);
    // apply options
    if (opts.enabled != null) enabled = !!opts.enabled;
    if (opts.tiltEnabled != null) tiltEnabled = !!opts.tiltEnabled;

    if (opts.strength != null) strength = clamp(opts.strength, 0, 2.5);
    if (opts.chroma != null) chroma = clamp(opts.chroma, 0, 2);
    if (opts.wobble != null) wobble = clamp(opts.wobble, 0, 2);
    if (opts.scan != null) scan = clamp(opts.scan, 0, 2);
    if (opts.vignette != null) vignette = clamp(opts.vignette, 0, 2);
    if (opts.speedlines != null) speedlines = clamp(opts.speedlines, 0, 2);

    // tilt
    try { if (tilt.cleanup) tilt.cleanup(); } catch {}
    tilt.cleanup = setupTilt();

    // listeners
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

  PostFXCanvas.setStorm = function (on) {
    storm = !!on;
  };

  PostFXCanvas.flash = function (type = 'good') {
    flashType = String(type || 'good');
    flashUntil = now() + FLASH_MS;
  };

  PostFXCanvas.setStrength = function (v) {
    strength = clamp(v, 0, 2.5);
  };

  PostFXCanvas.setParams = function (p = {}) {
    if (p.chroma != null) chroma = clamp(p.chroma, 0, 2);
    if (p.wobble != null) wobble = clamp(p.wobble, 0, 2);
    if (p.scan != null) scan = clamp(p.scan, 0, 2);
    if (p.vignette != null) vignette = clamp(p.vignette, 0, 2);
    if (p.speedlines != null) speedlines = clamp(p.speedlines, 0, 2);
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
