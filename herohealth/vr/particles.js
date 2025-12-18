// === /herohealth/vr/particles.js ===
// Hero Health Academy — FX layer (burst + score pop + judge pop)
// Cartoon Judge Upgrade:
// - Judge bubble = sticker style (outline + highlight + wobble)
// - Auto badge emoji by label (PERFECT/GOOD/MISS/BLOCK/...)
// - Require position; if missing => do nothing (no top-left/center ghosts)
// - Support coords: normalized (0..1), percent (0..100), or px with opts.px=true

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
      /* ---- SCORE POP (small pill) ---- */
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
        backdrop-filter: blur(8px);
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

      /* ---- JUDGE STICKER (cartoon bubble) ---- */
      .hha-judge{
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 16px;
        background: rgba(255,255,255,0.92);
        color: #0f172a;
        font-weight: 1000;
        font-size: 14px;
        letter-spacing: .02em;
        opacity: 0;
        transform: translate(-50%,-50%) scale(.75) rotate(-2deg);
        transform-origin: 50% 60%;
        border: 3px solid rgba(15,23,42,0.95); /* thick outline */
        box-shadow:
          0 18px 40px rgba(0,0,0,0.45),
          0 2px 0 rgba(15,23,42,0.9);
        backdrop-filter: blur(6px);
        animation: hha-judge-in 520ms cubic-bezier(.2,1.2,.25,1) forwards;
        white-space: nowrap;
      }
      .hha-judge:before{
        /* highlight */
        content:"";
        position:absolute;
        left: 10px;
        top: 7px;
        width: 46%;
        height: 36%;
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0));
        pointer-events:none;
      }
      .hha-judge:after{
        /* little tail */
        content:"";
        position:absolute;
        left: 14px;
        bottom: -10px;
        width: 16px;
        height: 16px;
        background: rgba(255,255,255,0.92);
        border-left: 3px solid rgba(15,23,42,0.95);
        border-bottom: 3px solid rgba(15,23,42,0.95);
        transform: rotate(45deg);
        border-bottom-left-radius: 6px;
      }

      .hha-judge .badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 3px solid rgba(15,23,42,0.95);
        box-shadow: 0 2px 0 rgba(15,23,42,0.85);
        font-size: 16px;
        line-height: 1;
        background: rgba(255,255,255,0.95);
      }
      .hha-judge .txt{
        position: relative;
        top: 0px;
      }

      /* theme tints */
      .hha-judge.good{ background: rgba(236,253,245,0.95); }
      .hha-judge.junk{ background: rgba(255,237,213,0.95); }
      .hha-judge.haz { background: rgba(254,226,226,0.95); }
      .hha-judge.power{ background: rgba(219,234,254,0.95); }
      .hha-judge.boss{ background: rgba(254,249,195,0.95); }

      @keyframes hha-judge-in{
        0%{ opacity: 0; transform: translate(-50%,-50%) scale(.70) rotate(-3deg); }
        35%{ opacity: 1; transform: translate(-50%,-54%) scale(1.06) rotate(2deg); }
        60%{ transform: translate(-50%,-58%) scale(1.00) rotate(-1deg); }
        100%{ opacity: 0; transform: translate(-50%,-74%) scale(.96) rotate(0deg); }
      }

      /* ---- BURST ---- */
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

  function toPx(x, y, opts = {}) {
    if (x == null || y == null) return null;

    const W = root.innerWidth || 1;
    const H = root.innerHeight || 1;

    if (opts.px) return { x: clamp(x, 0, W), y: clamp(y, 0, H) };

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
    if (!p) return;
    ensureStyles();
    const layer = ensureLayer();

    const dx = Number(opts.dx)||0;
    const dy = Number(opts.dy)||0;

    const pop = makeDiv('hha-pop ' + (opts.kind || ''), p.x + dx, p.y + dy);
    pop.textContent = String(text || '');
    layer.appendChild(pop);
    setTimeout(() => { try{ pop.remove(); }catch(_){} }, 650);
  }

  function badgeFor(label='') {
    const t = String(label||'').toUpperCase();
    if (t.includes('PERFECT')) return '🌟';
    if (t.includes('GOOD')) return '😊';
    if (t.includes('MISS')) return '💥';
    if (t.includes('BLOCK')) return '🛡️';
    if (t.includes('SHIELD')) return '🥗';
    if (t.includes('CLEANSE')) return '🍋';
    if (t.includes('GOLD')) return '⭐';
    if (t.includes('BOSS')) return '👾';
    if (t.includes('RISK') || t.includes('HAZ')) return '⚠️';
    if (t.includes('POWER')) return '✨';
    if (t.includes('CLEAR')) return '✅';
    return '🎯';
  }

  function judgeAt(x, y, label, opts = {}) {
    const p = toPx(x, y, opts);
    if (!p) return;
    ensureStyles();
    const layer = ensureLayer();

    const dx = Number(opts.dx)||0;
    const dy = Number(opts.dy)||0;

    const wrap = makeDiv('hha-judge ' + (opts.kind || ''), p.x + dx, p.y + dy);

    const badge = doc.createElement('span');
    badge.className = 'badge';
    badge.textContent = badgeFor(label);

    const txt = doc.createElement('span');
    txt.className = 'txt';
    txt.textContent = String(label || '');

    wrap.appendChild(badge);
    wrap.appendChild(txt);

    layer.appendChild(wrap);
    setTimeout(() => { try{ wrap.remove(); }catch(_){} }, 650);
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

  // event bridge: {type:'burst'|'score'|'judge', x,y, kind, text, dx, dy}
  root.addEventListener('hha:fx', (e) => {
    const d = e.detail || {};
    if (d.x == null || d.y == null) return; // must have position

    const type = String(d.type || '');
    if (type === 'burst') burstAt(d.x, d.y, d);
    else if (type === 'score') floatScoreAt(d.x, d.y, d.text, d);
    else if (type === 'judge') judgeAt(d.x, d.y, d.text, d);
  });

  // Back-compat: Particles.scorePop(xPct,yPct,text)
  function scorePop(xPct, yPct, text, opts = {}) {
    floatScoreAt(xPct, yPct, text, Object.assign({}, opts));
  }

  root.Particles = root.Particles || {};
  root.Particles.burstAt = burstAt;
  root.Particles.floatScoreAt = floatScoreAt;
  root.Particles.judgeAt = judgeAt;
  root.Particles.scorePop = scorePop;

})(window);
