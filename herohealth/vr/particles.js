// === /herohealth/vr/particles.js ===
// Hero Health Academy — FX layer (burst + score pop + judge pop)
// FIX:
// - Require position; if missing => do nothing (no top-left/center ghosts)
// - Support coords: normalized (0..1), percent (0..100), or px with opts.px=true
// - Back-compat: Particles.scorePop(xPct,yPct,text,opts)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  function clamp(v, a, b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (layer) return layer;

    layer = doc.createElement('div');
    layer.className = 'hha-fx-layer';
    Object.assign(layer.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: 720,
      overflow: 'hidden'
    });
    doc.body.appendChild(layer);
    return layer;
  }

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
      .hha-pop.junk, .hha-pop.haz{ border-color: rgba(249,115,22,0.42); }
      .hha-pop.power{ border-color: rgba(59,130,246,0.42); }
      .hha-pop.boss{ border-color: rgba(250,204,21,0.55); }

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

  // x,y can be:
  // - normalized 0..1
  // - percent 0..100 (heuristic if >1.5)
  // - px with opts.px=true
  function toPx(x, y, opts = {}) {
    if (x == null || y == null) return null;

    const W = root.innerWidth || 1;
    const H = root.innerHeight || 1;

    if (opts.px) {
      return { x: clamp(x, 0, W), y: clamp(y, 0, H) };
    }

    const nx = (x > 1.5) ? (x / 100) : x;
    const ny = (y > 1.5) ? (y / 100) : y;

    return { x: clamp(nx, 0, 1) * W, y: clamp(ny, 0, 1) * H };
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

  function floatScoreAt(x, y, text, opts = {}) {
    const p = toPx(x, y, opts);
    if (!p) return; // ✅ no position => no FX
    ensureStyles();
    const layer = ensureLayer();

    const dx = Number(opts.dx)||0;
    const dy = Number(opts.dy)||0;

    const pop = makeDiv('hha-pop ' + (opts.kind || ''), p.x + dx, p.y + dy);
    pop.textContent = String(text || '');
    layer.appendChild(pop);
    setTimeout(() => { try{ pop.remove(); }catch(_){} }, 650);
  }

  function judgeAt(x, y, label, opts = {}) {
    const p = toPx(x, y, opts);
    if (!p) return;
    ensureStyles();
    const layer = ensureLayer();

    const dx = Number(opts.dx)||0;
    const dy = Number(opts.dy)||0;

    const pop = makeDiv('hha-pop ' + (opts.kind || ''), p.x + dx, p.y + dy);
    pop.textContent = String(label || '');
    layer.appendChild(pop);
    setTimeout(() => { try{ pop.remove(); }catch(_){} }, 650);
  }

  function burstAt(x, y, opts = {}) {
    const p = toPx(x, y, opts);
    if (!p) return;
    ensureStyles();
    const layer = ensureLayer();

    const burst = makeDiv('hha-burst', p.x, p.y);
    layer.appendChild(burst);

    const n = clamp(opts.count || 14, 6, 26);
    const r = clamp(opts.radius || 92, 40, 160);

    for (let i=0;i<n;i++){
      const shard = doc.createElement('div');
      shard.className = 'hha-shard';

      const a = (Math.PI * 2) * (i / n) + (Math.random()*0.6);
      const rr = r * (0.65 + Math.random()*0.55);
      const dx = Math.cos(a) * rr;
      const dy = Math.sin(a) * rr;

      shard.style.setProperty('--dx', dx + 'px');
      shard.style.setProperty('--dy', dy + 'px');

      const kind = opts.kind || '';
      if (kind === 'good') shard.style.background = 'rgba(34,197,94,0.95)';
      else if (kind === 'junk' || kind === 'haz') shard.style.background = 'rgba(249,115,22,0.95)';
      else if (kind === 'power') shard.style.background = 'rgba(59,130,246,0.95)';
      else if (kind === 'boss') shard.style.background = 'rgba(250,204,21,0.95)';

      burst.appendChild(shard);
    }

    setTimeout(() => { try{ burst.remove(); }catch(_){} }, 520);
  }

  // ✅ event bridge: {type:'burst'|'score'|'judge', x,y, kind, text, dx, dy}
  root.addEventListener('hha:fx', (e) => {
    const d = e.detail || {};
    if (d.x == null || d.y == null) return; // ✅ MUST have position

    const type = String(d.type || '');
    if (type === 'burst') burstAt(d.x, d.y, d);
    else if (type === 'score') floatScoreAt(d.x, d.y, d.text, d);
    else if (type === 'judge') judgeAt(d.x, d.y, d.text, d);
  });

  // Back-compat helpers (percent coords)
  function scorePop(xPct, yPct, text, opts = {}) {
    floatScoreAt(xPct, yPct, text, Object.assign({ }, opts)); // heuristics: >1.5 => percent
  }

  root.Particles = root.Particles || {};
  root.Particles.burstAt = burstAt;
  root.Particles.floatScoreAt = floatScoreAt;
  root.Particles.judgeAt = judgeAt;
  root.Particles.scorePop = scorePop;

})(window);
