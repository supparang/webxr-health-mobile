// === /herohealth/vr/particles.js ===
// HeroHealth FX Layer (DOM) — burstAt / scorePop / judgePop / celebrate
// ✅ Works for all games (GoodJunk / Hydration / Plate / Groups)
// ✅ Zero dependency, auto-inject CSS, fixed layer, high z-index
// ✅ API:
//    Particles.burstAt(x,y,{label,good,heavy,count})
//    Particles.scorePop(x,y,delta,label,{plain})
//    Particles.judgePop(x,y,text,{good})
//    Particles.celebrate(kind,{title,sub,ultra})
//
// Notes:
// - x,y are viewport coordinates (clientX/clientY)
// - Will not block clicks (pointer-events:none)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  const NS = (root.GAME_MODULES = root.GAME_MODULES || {});

  // ---------- inject CSS once ----------
  const STYLE_ID = 'hha-fx-style-v3';
  function ensureStyle() {
    if (doc.getElementById(STYLE_ID)) return;

    const css = `
      .hha-fx-layer{
        position:fixed; inset:0;
        pointer-events:none;
        z-index:9999;
        overflow:hidden;
      }
      .hha-fx-pop{
        position:absolute;
        transform:translate(-50%,-50%);
        font-weight:950;
        letter-spacing:.02em;
        text-shadow:0 10px 28px rgba(0,0,0,.65);
        filter:drop-shadow(0 10px 18px rgba(0,0,0,.55));
        opacity:0;
        will-change: transform, opacity;
      }
      .hha-fx-pop.show{ opacity:1; }

      .hha-fx-score{
        font-size:clamp(14px, 2.8vw, 20px);
        padding:6px 10px;
        border-radius:999px;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.25);
        color:#e5e7eb;
      }
      .hha-fx-score.good{ border-color: rgba(34,197,94,.55); }
      .hha-fx-score.bad { border-color: rgba(249,115,22,.60); }
      .hha-fx-score.big { font-size:clamp(16px, 3.6vw, 24px); padding:7px 12px; }

      .hha-fx-judge{
        font-size:clamp(16px, 3.8vw, 28px);
        padding:8px 14px;
        border-radius:999px;
        background:rgba(2,6,23,.50);
        border:1px solid rgba(148,163,184,.22);
        color:#fde68a;
      }
      .hha-fx-judge.good{ color:#bbf7d0; border-color: rgba(34,197,94,.55); }
      .hha-fx-judge.bad{ color:#fdba74; border-color: rgba(249,115,22,.60); }

      .hha-fx-float{
        animation:hhaFloatUp .65s ease-out forwards;
      }
      @keyframes hhaFloatUp{
        0%{ opacity:0; transform:translate(-50%,-50%) translateY(8px) scale(.92); }
        15%{ opacity:1; transform:translate(-50%,-50%) translateY(0) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) translateY(-28px) scale(.98); }
      }

      .hha-fx-shard{
        position:absolute;
        width:8px; height:8px;
        border-radius:3px;
        opacity:0.98;
        transform:translate(-50%,-50%);
        will-change: transform, opacity;
        filter:drop-shadow(0 10px 16px rgba(0,0,0,.45));
      }
      .hha-fx-shard.good{ background:rgba(34,197,94,.92); }
      .hha-fx-shard.bad { background:rgba(249,115,22,.92); }
      .hha-fx-shard.gold{ background:rgba(250,204,21,.95); }
      .hha-fx-shard.cyan{ background:rgba(56,189,248,.92); }
      .hha-fx-shard.purple{ background:rgba(168,85,247,.92); }

      .hha-fx-burst{
        animation:hhaBurst .55s ease-out forwards;
      }
      @keyframes hhaBurst{
        0%{ opacity:0; transform:translate(-50%,-50%) translate(0,0) scale(1); }
        15%{ opacity:1; }
        100%{ opacity:0; transform:translate(-50%,-50%) translate(var(--dx), var(--dy)) scale(.85); }
      }

      .hha-fx-banner{
        position:fixed; left:50%; top:18%;
        transform:translateX(-50%);
        z-index:10000;
        pointer-events:none;
        display:flex;
        align-items:center;
        gap:10px;
        padding:10px 14px;
        border-radius:999px;
        background:radial-gradient(circle at top left, rgba(250,250,250,.16), transparent 55%), rgba(8,47,73,.92);
        border:1px solid rgba(251,191,36,.75);
        color:#fef9c3;
        font-weight:950;
        box-shadow:0 24px 60px rgba(15,23,42,.95);
        opacity:0;
      }
      .hha-fx-banner.show{
        animation:hhaBanner .95s ease-out forwards;
      }
      @keyframes hhaBanner{
        0%{ opacity:0; transform:translateX(-50%) translateY(-10px) scale(.92); }
        20%{ opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
        70%{ opacity:1; }
        100%{ opacity:0; transform:translateX(-50%) translateY(6px) scale(.98); }
      }
      .hha-fx-banner .t{ font-size:clamp(14px, 3.2vw, 18px); }
      .hha-fx-banner .s{ font-size:clamp(11px, 2.4vw, 13px); opacity:.92; font-weight:800; }
      .hha-fx-banner.ultra{
        top:22%;
        border-color: rgba(34,197,94,.75);
        color:#dcfce7;
        background:radial-gradient(circle at top left, rgba(34,197,94,.20), transparent 55%), rgba(2,6,23,.90);
      }
    `;

    const st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = css;
    doc.head.appendChild(st);
  }

  // ---------- layer ----------
  function ensureLayer() {
    ensureStyle();
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      doc.body.appendChild(layer);
    }
    return layer;
  }

  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // ---------- primitives ----------
  function popText(x, y, className, text, lifeMs = 650) {
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = `hha-fx-pop ${className || ''}`;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.textContent = text || '';
    layer.appendChild(el);

    // next tick -> animate
    requestAnimationFrame(() => el.classList.add('show', 'hha-fx-float'));

    setTimeout(() => {
      try { el.remove(); } catch (_) {}
    }, lifeMs);
  }

  function burstAt(x, y, opts = {}) {
    const layer = ensureLayer();

    const good = !!opts.good;
    const heavy = !!opts.heavy;
    const count = clamp(opts.count ?? (heavy ? 18 : 12), 6, 28);

    // label (optional)
    if (opts.label) {
      popText(x, y - 34, `hha-fx-judge ${good ? 'good' : 'bad'}`, String(opts.label), 650);
    }

    // shards
    for (let i = 0; i < count; i++) {
      const s = doc.createElement('div');
      const kind =
        opts.kind ||
        (opts.label && String(opts.label).includes('GOLD') ? 'gold' :
         opts.label && String(opts.label).includes('POWER') ? 'cyan' :
         opts.label && String(opts.label).includes('FAKE') ? 'purple' :
         good ? 'good' : 'bad');

      s.className = `hha-fx-shard ${kind} hha-fx-burst`;

      const dx = rand(-80, 80) + (heavy ? rand(-30, 30) : 0);
      const dy = rand(-90, 50) + (heavy ? rand(-20, 20) : 0);

      s.style.setProperty('--dx', dx.toFixed(1) + 'px');
      s.style.setProperty('--dy', dy.toFixed(1) + 'px');

      const size = heavy ? rand(7, 12) : rand(6, 10);
      s.style.width = size.toFixed(1) + 'px';
      s.style.height = size.toFixed(1) + 'px';

      s.style.left = x + 'px';
      s.style.top = y + 'px';

      layer.appendChild(s);
      setTimeout(() => { try { s.remove(); } catch (_) {} }, 560);
    }
  }

  function scorePop(x, y, delta, label, opts = {}) {
    const d = (typeof delta === 'number') ? delta : null;
    const sign = (d === null) ? '' : (d > 0 ? '+' : '');
    const txt = opts.plain ? (label || '') : (d === null ? (label || '') : `${sign}${d}  ${label || ''}`.trim());

    // style based on label
    const s = String(label || '');
    const isBad = s.includes('MISS') || s.includes('JUNK') || s.includes('OOPS') || s.includes('BAD');
    const isGold = s.includes('GOLD') || s.includes('PERFECT') || s.includes('BOSS');

    popText(
      x, y,
      `hha-fx-score ${(isBad ? 'bad' : 'good')} ${(isGold ? 'big' : '')}`,
      txt,
      700
    );
  }

  function judgePop(x, y, text, opts = {}) {
    popText(x, y, `hha-fx-judge ${opts.good ? 'good' : 'bad'}`, String(text || ''), 650);
  }

  function celebrate(kind = 'mini', meta = {}) {
    // banner
    const title = meta.title || (kind === 'goal' ? '🎉 GOAL CLEARED!' :
                                kind === 'end'  ? '🏁 FINISH!' :
                                kind === 'fever'? '🔥 FEVER!' :
                                kind === 'ultra'? '💥 AWESOME!' : '✨ MINI CLEARED!');
    const sub = meta.sub || 'ไปต่อเลย! 🌟';

    const banner = doc.createElement('div');
    banner.className = 'hha-fx-banner' + (meta.ultra || kind === 'ultra' ? ' ultra' : '');
    banner.innerHTML = `<div class="t">${title}</div><div class="s">${sub}</div>`;
    doc.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('show'));
    setTimeout(() => { try { banner.remove(); } catch (_) {} }, 980);

    // confetti burst at center
    const cx = root.innerWidth / 2;
    const cy = root.innerHeight * 0.24;
    burstAt(cx, cy, { good: true, heavy: true, count: 22, label: '' });
  }

  // ---------- expose ----------
  const API = { ensureLayer, burstAt, scorePop, judgePop, celebrate };
  root.Particles = API;
  NS.Particles = API;

})(typeof window !== 'undefined' ? window : globalThis);
/* === HHA Particles ADDON: FloatingPop (SAFE) =========================
   Listen: hha:floatpop { text, x, y, kind, size, ms, dx }
   - ไม่ชนของเดิม
   - ใช้ .hha-fx-layer ถ้ามีอยู่แล้ว; ถ้าไม่มีจะสร้างให้
====================================================================== */

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function ensureFxLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        pointerEvents: 'none',
        zIndex: 9999
      });
      doc.body.appendChild(layer);
    }
    return layer;
  }

  function floatPop(text, x, y, opts = {}) {
    const layer = ensureFxLayer();
    if (!layer) return;

    const ms = Math.max(260, Number(opts.ms || 720));
    const size = String(opts.size || 'small'); // small | big
    const kind = String(opts.kind || 'info');  // info | warn | bad | good | gold
    const dx = (typeof opts.dx === 'number') ? opts.dx : 0;

    const el = doc.createElement('div');
    el.textContent = String(text || '');

    Object.assign(el.style, {
      position: 'fixed',
      left: (Number(x) || innerWidth * 0.5) + 'px',
      top: (Number(y) || innerHeight * 0.5) + 'px',
      transform: 'translate(-50%,-50%) scale(1)',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans Thai", sans-serif',
      fontWeight: '1000',
      letterSpacing: '.02em',
      fontSize: (size === 'big') ? '22px' : '16px',
      padding: (size === 'big') ? '10px 14px' : '8px 12px',
      borderRadius: '999px',
      border: '1px solid rgba(148,163,184,.22)',
      background: 'rgba(2,6,23,.72)',
      color: '#e5e7eb',
      textShadow: '0 8px 20px rgba(0,0,0,.55)',
      boxShadow: '0 18px 50px rgba(0,0,0,.45)',
      opacity: '0',
      willChange: 'transform, opacity'
    });

    // accent border by kind
    if (kind.includes('warn')) el.style.border = '1px solid rgba(245,158,11,.35)';
    if (kind.includes('bad'))  el.style.border = '1px solid rgba(251,113,133,.35)';
    if (kind.includes('good')) el.style.border = '1px solid rgba(34,197,94,.35)';
    if (kind.includes('gold')) el.style.border = '1px solid rgba(250,204,21,.35)';

    layer.appendChild(el);

    const rise = (size === 'big') ? 56 : 42;
    const startY = 0;
    const endY = -rise;

    requestAnimationFrame(() => {
      el.style.transition = `opacity 120ms ease, transform ${ms}ms ease`;
      el.style.opacity = '1';
      el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${startY}px)) scale(1)`;
    });

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${endY}px)) scale(.98)`;
    }, Math.max(140, ms - 180));

    setTimeout(() => { try { el.remove(); } catch (_) {} }, ms + 160);
  }

  // กัน bind ซ้ำ
  if (!root.__HHA_FLOATPOP_BOUND__) {
    root.__HHA_FLOATPOP_BOUND__ = true;

    root.addEventListener('hha:floatpop', (e) => {
      const d = (e && e.detail) || {};
      floatPop(d.text || d.label || '', d.x, d.y, d);
    }, { passive: true });
  }

})(window);