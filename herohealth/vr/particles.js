// === /herohealth/vr/particles.js ===
// Hero Health Academy — FX layer (burst + score pop + judge pop)
// LINE Sticker Style Upgrade:
// - MISS: shake mạnh + explode comic
// - PERFECT: sparkle stars twinkle around + pop bounce
// - Big head badge + bouncy text + thick outline

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
      /* ---- SCORE POP ---- */
      .hha-pop{
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(15,23,42,0.78);
        border: 2px solid rgba(148,163,184,0.22);
        box-shadow: 0 16px 40px rgba(0,0,0,0.45);
        font-weight: 1000;
        font-size: 14px;
        letter-spacing: .02em;
        color: #e5e7eb;
        opacity: 0;
        animation: hha-pop-up .55s ease-out forwards;
        white-space: nowrap;
        backdrop-filter: blur(8px);
      }
      .hha-pop.good{ border-color: rgba(34,197,94,0.55); }
      .hha-pop.junk, .hha-pop.haz{ border-color: rgba(249,115,22,0.55); }
      .hha-pop.power{ border-color: rgba(59,130,246,0.55); }
      .hha-pop.boss{ border-color: rgba(250,204,21,0.75); }

      @keyframes hha-pop-up{
        0%{ transform: translate(-50%,-50%) scale(.85); opacity: 0; }
        18%{ opacity: 1; transform: translate(-50%,-54%) scale(1.08); }
        100%{ transform: translate(-50%,-68%) scale(0.98); opacity: 0; }
      }

      /* ---- JUDGE STICKER (LINE style) ---- */
      .hha-judge{
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 11px 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.96);
        color: #0f172a;
        font-weight: 1000;
        font-size: 15px;
        letter-spacing: .02em;
        opacity: 0;
        transform: translate(-50%,-50%) scale(.6);
        transform-origin: 50% 65%;
        border: 4px solid rgba(15,23,42,0.98); /* thick outline */
        box-shadow:
          0 20px 46px rgba(0,0,0,0.46),
          0 3px 0 rgba(15,23,42,0.95);
        backdrop-filter: blur(6px);
        white-space: nowrap;
        animation: hha-judge-bounce 640ms cubic-bezier(.2,1.35,.25,1) forwards;
      }
      .hha-judge:before{
        /* highlight */
        content:"";
        position:absolute;
        left: 10px;
        top: 8px;
        width: 48%;
        height: 38%;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,0.90), rgba(255,255,255,0));
        pointer-events:none;
      }
      .hha-judge:after{
        /* tail */
        content:"";
        position:absolute;
        left: 16px;
        bottom: -12px;
        width: 18px;
        height: 18px;
        background: rgba(255,255,255,0.96);
        border-left: 4px solid rgba(15,23,42,0.98);
        border-bottom: 4px solid rgba(15,23,42,0.98);
        transform: rotate(45deg);
        border-bottom-left-radius: 7px;
      }

      .hha-judge .badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        width: 34px;          /* big head */
        height: 34px;
        border-radius: 999px;
        border: 4px solid rgba(15,23,42,0.98);
        box-shadow: 0 3px 0 rgba(15,23,42,0.95);
        font-size: 18px;
        line-height: 1;
        background: rgba(255,255,255,0.98);
        transform: rotate(-6deg);
      }
      .hha-judge .txt{
        position: relative;
        top: 1px;
        text-shadow: 0 1px 0 rgba(255,255,255,0.7);
      }
      /* bouncy text wobble */
      .hha-judge .txt{
        animation: hha-text-wobble 640ms cubic-bezier(.2,1.35,.25,1) forwards;
      }
      @keyframes hha-text-wobble{
        0%{ transform: translateY(2px) scale(.85); }
        40%{ transform: translateY(-1px) scale(1.10); }
        70%{ transform: translateY(0px) scale(0.98); }
        100%{ transform: translateY(-1px) scale(1.00); }
      }

      /* theme tints */
      .hha-judge.good{ background: rgba(236,253,245,0.98); }
      .hha-judge.junk{ background: rgba(255,237,213,0.98); }
      .hha-judge.haz { background: rgba(254,226,226,0.98); }
      .hha-judge.power{ background: rgba(219,234,254,0.98); }
      .hha-judge.boss{ background: rgba(254,249,195,0.98); }

      /* main bounce */
      @keyframes hha-judge-bounce{
        0%{ opacity: 0; transform: translate(-50%,-50%) scale(.55) rotate(-4deg); }
        22%{ opacity: 1; transform: translate(-50%,-56%) scale(1.16) rotate(3deg); }
        48%{ transform: translate(-50%,-60%) scale(0.98) rotate(-1deg); }
        100%{ opacity: 0; transform: translate(-50%,-82%) scale(.96) rotate(0deg); }
      }

      /* MISS: violent shake */
      .hha-judge.miss{
        animation: hha-judge-miss 650ms cubic-bezier(.2,1.35,.25,1) forwards;
      }
      @keyframes hha-judge-miss{
        0%{ opacity: 0; transform: translate(-50%,-50%) scale(.62) rotate(-6deg); }
        18%{ opacity: 1; transform: translate(-50%,-54%) scale(1.10) rotate(4deg); }
        28%{ transform: translate(calc(-50% - 12px), calc(-56% - 2px)) rotate(-6deg) scale(1.08); }
        36%{ transform: translate(calc(-50% + 14px), calc(-56% + 2px)) rotate(7deg) scale(1.06); }
        44%{ transform: translate(calc(-50% - 16px), calc(-56% - 1px)) rotate(-7deg) scale(1.05); }
        52%{ transform: translate(calc(-50% + 12px), calc(-56% + 1px)) rotate(6deg) scale(1.03); }
        60%{ transform: translate(-50%,-60%) rotate(-2deg) scale(1.00); }
        100%{ opacity: 0; transform: translate(-50%,-84%) rotate(0deg) scale(.96); }
      }

      /* PERFECT: sparkle wrapper */
      .hha-sparkle{
        position: fixed;
        pointer-events:none;
        transform: translate(-50%,-50%);
        z-index: 721;
      }
      .hha-star{
        position:absolute;
        left: 0;
        top: 0;
        font-size: 18px;
        opacity: 0;
        filter: drop-shadow(0 10px 16px rgba(0,0,0,0.35));
        animation: hha-star 520ms ease-out forwards;
      }
      @keyframes hha-star{
        0%{ opacity: 0; transform: translate(0,0) scale(.5) rotate(0deg); }
        20%{ opacity: 1; }
        100%{ opacity: 0; transform: translate(var(--sx), var(--sy)) scale(1.15) rotate(55deg); }
      }

      /* BURST */
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

    const nx = (x > 1.5) ? (x / 100) : x; // 0..1 or 0..100
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
    setTimeout(() => { try{ pop.remove(); }catch(_){} }, 700);
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

  function sparklesAt(x, y, opts = {}) {
    const p = toPx(x, y, opts);
    if (!p) return;
    ensureStyles();
    const layer = ensureLayer();

    const sp = makeDiv('hha-sparkle', p.x, p.y);
    layer.appendChild(sp);

    const n = clamp(opts.count || 8, 5, 14);
    for (let i=0;i<n;i++){
      const star = doc.createElement('div');
      star.className = 'hha-star';
      star.textContent = (i % 3 === 0) ? '✨' : (i % 3 === 1) ? '⭐' : '💫';

      const a = (Math.PI*2) * (i/n) + (Math.random()*0.45);
      const rr = (opts.radius || 80) * (0.55 + Math.random()*0.65);
      const sx = Math.cos(a) * rr;
      const sy = Math.sin(a) * rr;

      star.style.setProperty('--sx', sx + 'px');
      star.style.setProperty('--sy', sy + 'px');

      // random delay for twinkle
      star.style.animationDelay = (Math.random()*80) + 'ms';
      star.style.left = '0px';
      star.style.top  = '0px';

      sp.appendChild(star);
    }

    setTimeout(() => { try{ sp.remove(); }catch(_){} }, 650);
  }

  function judgeAt(x, y, label, opts = {}) {
    const p = toPx(x, y, opts);
    if (!p) return;
    ensureStyles();
    const layer = ensureLayer();

    const dx = Number(opts.dx)||0;
    const dy = Number(opts.dy)||0;

    const kind = (opts.kind || '');
    const txtUp = String(label || '');

    const wrap = makeDiv('hha-judge ' + kind, p.x + dx, p.y + dy);

    // MISS special class => violent shake
    if (txtUp.toUpperCase().includes('MISS')) wrap.classList.add('miss');

    const badge = doc.createElement('span');
    badge.className = 'badge';
    badge.textContent = badgeFor(label);

    const txt = doc.createElement('span');
    txt.className = 'txt';
    txt.textContent = txtUp;

    wrap.appendChild(badge);
    wrap.appendChild(txt);
    layer.appendChild(wrap);

    // PERFECT -> sparkle stars
    if (txtUp.toUpperCase().includes('PERFECT')) {
      sparklesAt(x, y, { count: 10, radius: 92 });
    }

    setTimeout(() => { try{ wrap.remove(); }catch(_){} }, 720);
  }

  function burstAt(x, y, opts = {}) {
    const p = toPx(x, y, opts);
    if (!p) return;
    ensureStyles();
    const layer = ensureLayer();

    const burst = makeDiv('hha-burst', p.x, p.y);
    layer.appendChild(burst);

    const n = clamp(opts.count || 14, 6, 26);
    const r = clamp(opts.radius || 92, 40, 170);

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
