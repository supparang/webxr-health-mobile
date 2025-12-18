// === /herohealth/vr/particles.js ===
// Hero Health Academy — FX layer (burst + score pop + judge pop)
// FIX (Dec 2025):
// - Only show FX when caller provides screen position {x,y} (0..1 or px)
// - Prevent duplicate layers
// - Provide public API: burstAt(x,y,opts), floatScoreAt(x,y,text,opts), judgeAt(x,y,text,opts)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  // ---------------- Layer ----------------
  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: 720, // above HUD (650) but below modals if any
      overflow: 'hidden'
    });
    doc.body.appendChild(layer);
    return layer;
  }

  // ---------------- Utils ----------------
  function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  // Accept (x,y) as:
  // - normalized 0..1 (screen fraction)  OR
  // - pixel coords when opts.px = true
  function toPx(x, y, opts = {}) {
    const W = root.innerWidth || 1;
    const H = root.innerHeight || 1;
    const px = !!opts.px;

    if (px) {
      return { x: clamp(x, 0, W), y: clamp(y, 0, H) };
    }
    return { x: clamp(x, 0, 1) * W, y: clamp(y, 0, 1) * H };
  }

  function makeDiv(className, xPx, yPx) {
    const el = doc.createElement('div');
    el.className = className;
    Object.assign(el.style, {
      position: 'fixed',
      left: xPx + 'px',
      top: yPx + 'px',
      transform: 'translate(-50%,-50%)',
      pointerEvents: 'none',
      willChange: 'transform, opacity'
    });
    return el;
  }

  // ---------------- Styles (inject once) ----------------
  function ensureStyles(){
    if (doc.getElementById('hha-fx-style')) return;
    const st = doc.createElement('style');
    st.id = 'hha-fx-style';
    st.textContent = `
      .hha-pop{
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(15,23,42,0.78);
        border: 1px solid rgba(148,163,184,0.22);
        box-shadow: 0 16px 40px rgba(0,0,0,0.45);
        font-weight: 900;
        font-size: 14px;
        letter-spacing: .02em;
        color: #e5e7eb;
        opacity: 0;
        animation: hha-pop-up .55s ease-out forwards;
        white-space: nowrap;
      }
      .hha-pop.good{ border-color: rgba(34,197,94,0.42); }
      .hha-pop.junk{ border-color: rgba(249,115,22,0.42); }
      .hha-pop.power{ border-color: rgba(59,130,246,0.42); }
      .hha-pop.boss{ border-color: rgba(250,204,21,0.55); }
      .hha-pop .small{ font-size: 12px; opacity: .9; font-weight: 800; margin-left: 6px; }

      @keyframes hha-pop-up{
        0%{ transform: translate(-50%,-50%) scale(.88); opacity: 0; }
        15%{ opacity: 1; }
        100%{ transform: translate(-50%,-64%) scale(1.0); opacity: 0; }
      }

      .hha-burst{
        position: fixed;
        width: 10px;
        height: 10px;
        transform: translate(-50%,-50%);
        pointer-events: none;
        opacity: 1;
      }
      .hha-shard{
        position:absolute;
        left: 50%;
        top: 50%;
        width: 6px;
        height: 6px;
        border-radius: 4px;
        background: rgba(255,255,255,0.92);
        transform: translate(-50%,-50%);
        opacity: 0.95;
        filter: drop-shadow(0 10px 14px rgba(0,0,0,0.35));
        animation: hha-shard 420ms ease-out forwards;
      }
      @keyframes hha-shard{
        0%{ transform: translate(-50%,-50%) scale(1); opacity: 1; }
        100%{ transform: translate(var(--dx), var(--dy)) scale(.2); opacity: 0; }
      }
    `;
    doc.head.appendChild(st);
  }

  // ---------------- Public FX ----------------
  function floatScoreAt(x, y, text, opts = {}) {
    if (x == null || y == null) return; // ✅ no position => do nothing
    ensureStyles();
    const layer = ensureLayer();
    const {x: px, y: py} = toPx(x, y, opts);

    const pop = makeDiv('hha-pop ' + (opts.kind || ''), px, py);
    pop.textContent = String(text || '');
    layer.appendChild(pop);

    // auto remove
    setTimeout(() => { try{ pop.remove(); }catch(_){} }, 650);
  }

  function judgeAt(x, y, label, opts = {}) {
    if (x == null || y == null) return; // ✅ no position => do nothing
    ensureStyles();
    const layer = ensureLayer();
    const {x: px, y: py} = toPx(x, y, opts);

    const pop = makeDiv('hha-pop ' + (opts.kind || ''), px + (opts.dx || 0), py + (opts.dy || 0));
    // “คำตัดสิน + คะแนน” แบบคู่กันได้
    pop.innerHTML = `${String(label || '')}`;
    layer.appendChild(pop);
    setTimeout(() => { try{ pop.remove(); }catch(_){} }, 650);
  }

  function burstAt(x, y, opts = {}) {
    if (x == null || y == null) return; // ✅ no position => do nothing
    ensureStyles();
    const layer = ensureLayer();
    const {x: px, y: py} = toPx(x, y, opts);

    const burst = makeDiv('hha-burst', px, py);
    layer.appendChild(burst);

    const n = clamp(opts.count || 14, 6, 24);
    const r = clamp(opts.radius || 90, 40, 150);

    for (let i=0;i<n;i++){
      const shard = doc.createElement('div');
      shard.className = 'hha-shard';

      const a = (Math.PI * 2) * (i / n) + (Math.random()*0.6);
      const rr = r * (0.65 + Math.random()*0.55);
      const dx = Math.cos(a) * rr;
      const dy = Math.sin(a) * rr;

      shard.style.setProperty('--dx', (dx) + 'px');
      shard.style.setProperty('--dy', (dy) + 'px');

      // tint
      const kind = opts.kind || '';
      if (kind === 'good') shard.style.background = 'rgba(34,197,94,0.95)';
      else if (kind === 'junk') shard.style.background = 'rgba(249,115,22,0.95)';
      else if (kind === 'power') shard.style.background = 'rgba(59,130,246,0.95)';
      else if (kind === 'boss') shard.style.background = 'rgba(250,204,21,0.95)';

      burst.appendChild(shard);
    }

    setTimeout(() => { try{ burst.remove(); }catch(_){} }, 520);
  }

  // ---------------- Event bridge ----------------
  // ✅ ใช้ event เดียวสำหรับ FX แบบระบุตำแหน่ง
  root.addEventListener('hha:fx', (e) => {
    const d = e.detail || {};
    const type = String(d.type || '');
    if (d.x == null || d.y == null) return; // ✅ no position => ignore

    if (type === 'burst') burstAt(d.x, d.y, d);
    else if (type === 'score') floatScoreAt(d.x, d.y, d.text, d);
    else if (type === 'judge') judgeAt(d.x, d.y, d.text, d);
  });

  // Export API
  root.Particles = root.Particles || {};
  root.Particles.burstAt = burstAt;
  root.Particles.floatScoreAt = floatScoreAt;
  root.Particles.judgeAt = judgeAt;

})(window);
