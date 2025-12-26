// === /herohealth/vr/particles.js ===
// HeroHealth — Simple FX layer (universal) — PRODUCTION
// - score pop + judgement text + target burst
// - celebration FX: goal / mini / all
// - supports GroupsVR events too (groups:stun etc.)
// ✅ idempotent bind (won't double listen)

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  root.GAME_MODULES = root.GAME_MODULES || {};
  if (root.GAME_MODULES.Particles && root.GAME_MODULES.Particles.__bound) {
    // already set
    return;
  }

  // ---------------- Layer ----------------
  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        zIndex: 999,
        pointerEvents: 'none',
        overflow: 'hidden'
      });
      doc.body.appendChild(layer);
    }
    return layer;
  }

  // ---------------- Utils ----------------
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
  function now() { return (performance && performance.now) ? performance.now() : Date.now(); }

  function makeDiv(cls) {
    const d = doc.createElement('div');
    if (cls) d.className = cls;
    return d;
  }

  function posStyle(el, x, y) {
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
  }

  function viewportCenter() {
    return { x: (innerWidth || 360) / 2, y: (innerHeight || 640) / 2 };
  }

  // ---------------- Score Pop ----------------
  function scorePop(text, x, y, opt) {
    const layer = ensureLayer();
    const o = opt || {};
    const d = makeDiv('hha-score-pop');
    const c = (typeof x === 'number' && typeof y === 'number') ? { x, y } : viewportCenter();

    d.textContent = String(text == null ? '' : text);

    Object.assign(d.style, {
      position: 'absolute',
      transform: 'translate(-50%,-50%)',
      fontWeight: '900',
      fontSize: (o.size || 20) + 'px',
      letterSpacing: '.2px',
      opacity: '0',
      textShadow: '0 10px 28px rgba(0,0,0,.55)',
      willChange: 'transform, opacity',
      userSelect: 'none'
    });

    // color by kind
    const kind = String(o.kind || 'good');
    if (kind === 'bad' || kind === 'warn') d.style.color = 'rgba(239,68,68,.95)';
    else if (kind === 'gold') d.style.color = 'rgba(245,158,11,.98)';
    else if (kind === 'cyan') d.style.color = 'rgba(34,211,238,.98)';
    else d.style.color = 'rgba(34,197,94,.98)';

    posStyle(d, c.x, c.y);
    layer.appendChild(d);

    // animate
    const t0 = now();
    const dur = o.dur || 520;

    function tick() {
      const t = (now() - t0) / dur;
      const p = clamp(t, 0, 1);

      // up + fade
      const dy = -26 * p;
      const sc = 0.92 + 0.18 * (1 - Math.abs(0.5 - p) * 2);
      d.style.opacity = String(1 - p);
      d.style.transform = `translate(-50%,-50%) translateY(${dy}px) scale(${sc})`;

      if (p < 1) requestAnimationFrame(tick);
      else { try { d.remove(); } catch (_) {} }
    }

    d.style.opacity = '1';
    requestAnimationFrame(tick);
  }

  // ---------------- Judge Text (center) ----------------
  function judgeText(text, opt) {
    const layer = ensureLayer();
    const o = opt || {};
    const d = makeDiv('hha-judge');
    d.textContent = String(text || '');

    Object.assign(d.style, {
      position: 'absolute',
      left: '50%',
      top: '44%',
      transform: 'translate(-50%,-50%) scale(.96)',
      padding: '10px 14px',
      borderRadius: '999px',
      fontWeight: '1000',
      letterSpacing: '.8px',
      fontSize: (o.size || 22) + 'px',
      color: 'rgba(229,231,235,.96)',
      background: 'rgba(2,6,23,.55)',
      border: '1px solid rgba(148,163,184,.18)',
      boxShadow: '0 18px 60px rgba(0,0,0,.45)',
      opacity: '0',
      willChange: 'transform, opacity'
    });

    const kind = String(o.kind || '');
    if (kind === 'warn') {
      d.style.borderColor = 'rgba(245,158,11,.26)';
      d.style.background = 'rgba(245,158,11,.10)';
    } else if (kind === 'bad') {
      d.style.borderColor = 'rgba(239,68,68,.26)';
      d.style.background = 'rgba(239,68,68,.10)';
    } else if (kind === 'good') {
      d.style.borderColor = 'rgba(34,197,94,.22)';
      d.style.background = 'rgba(34,197,94,.10)';
    }

    layer.appendChild(d);

    const t0 = now();
    const dur = o.dur || 620;

    function tick() {
      const t = (now() - t0) / dur;
      const p = clamp(t, 0, 1);
      const ease = 1 - Math.pow(1 - p, 3);

      d.style.opacity = String(p < 0.12 ? (p / 0.12) : (p > 0.88 ? (1 - (p - 0.88) / 0.12) : 1));
      d.style.transform = `translate(-50%,-50%) scale(${0.96 + 0.06 * Math.sin(ease * Math.PI)})`;

      if (p < 1) requestAnimationFrame(tick);
      else { try { d.remove(); } catch (_) {} }
    }

    requestAnimationFrame(tick);
  }

  // ---------------- Burst Particles ----------------
  function burstAt(x, y, opt) {
    const layer = ensureLayer();
    const o = opt || {};
    const n = clamp(o.count || 14, 6, 44);

    const kind = String(o.kind || 'good');
    const baseColor =
      (kind === 'bad' || kind === 'junk') ? 'rgba(239,68,68,.95)' :
      (kind === 'gold') ? 'rgba(245,158,11,.95)' :
      (kind === 'cyan') ? 'rgba(34,211,238,.95)' :
      'rgba(34,197,94,.95)';

    for (let i = 0; i < n; i++) {
      const p = makeDiv('hha-particle');
      const ang = Math.random() * Math.PI * 2;
      const spd = (o.spread || 140) * (0.55 + Math.random() * 0.75);
      const dx = Math.cos(ang) * spd;
      const dy = Math.sin(ang) * spd;
      const sz = (o.size || 8) * (0.6 + Math.random() * 1.1);
      const t0 = now();
      const dur = (o.dur || 520) * (0.75 + Math.random() * 0.7);
      const rot = (Math.random() * 360) | 0;

      Object.assign(p.style, {
        position: 'absolute',
        width: Math.round(sz) + 'px',
        height: Math.round(sz) + 'px',
        borderRadius: (Math.random() < 0.35) ? '999px' : '6px',
        background: baseColor,
        left: Math.round(x) + 'px',
        top: Math.round(y) + 'px',
        transform: 'translate(-50%,-50%)',
        opacity: '1',
        filter: 'drop-shadow(0 10px 20px rgba(0,0,0,.35))',
        willChange: 'transform, opacity'
      });

      layer.appendChild(p);

      function tick() {
        const t = (now() - t0) / dur;
        const pr = clamp(t, 0, 1);

        // ballistic-ish
        const gx = dx * pr;
        const gy = dy * pr + (0.5 * 520 * pr * pr) * 0.12; // small gravity
        const sc = 1 - pr * 0.25;

        p.style.opacity = String(1 - pr);
        p.style.transform = `translate(-50%,-50%) translate(${gx}px, ${gy}px) rotate(${rot + pr * 260}deg) scale(${sc})`;

        if (pr < 1) requestAnimationFrame(tick);
        else { try { p.remove(); } catch (_) {} }
      }

      requestAnimationFrame(tick);
    }
  }

  // ---------------- Celebration FX ----------------
  function celebrate(kind, text) {
    const k = String(kind || 'mini');
    const label =
      text || (k === 'goal' ? 'GOAL CLEAR!' : (k === 'all' ? 'ALL CLEAR!' : 'MINI CLEAR!'));

    // center judge + confetti burst
    judgeText(label, { kind: (k === 'goal' ? 'good' : (k === 'all' ? 'gold' : 'cyan')), dur: 780, size: 26 });

    const c = viewportCenter();
    burstAt(c.x, c.y, { kind: (k === 'all' ? 'gold' : (k === 'mini' ? 'cyan' : 'good')), count: (k === 'all' ? 34 : 22), spread: (k === 'all' ? 220 : 180), dur: 720, size: (k === 'all' ? 10 : 9) });

    // subtle screen pop
    doc.documentElement.classList.add('hha-celebrate-pop');
    setTimeout(() => doc.documentElement.classList.remove('hha-celebrate-pop'), 220);
  }

  // ---------------- Event bindings ----------------
  function onScore(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    // optional: if engine emits delta => show pop
    if (typeof d.delta === 'number' && d.delta !== 0) {
      const c = viewportCenter();
      scorePop((d.delta > 0 ? '+' : '') + d.delta, c.x, c.y + 80, { kind: d.delta > 0 ? 'good' : 'bad' });
    }
  }

  function onJudge(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    if (!d || !d.text) return;
    judgeText(String(d.text), { kind: d.kind || '', dur: 640 });
  }

  function onCelebrate(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    celebrate(d.kind, d.text);
  }

  // useful for Groups: stun
  function onGroupsStun(ev) {
    const d = (ev && ev.detail) ? ev.detail : {};
    // add extra micro FX if needed
    const c = viewportCenter();
    burstAt(c.x, c.y, { kind: 'bad', count: 16, spread: 140, dur: 520, size: 8 });
    judgeText('STUN!', { kind: 'bad', dur: 520, size: 24 });
  }

  // optional helper: call burst at target rect
  function burstOnElement(el, opt) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    burstAt(x, y, opt);
  }

  // bind once
  root.addEventListener('hha:score', onScore, { passive: true });
  root.addEventListener('hha:judge', onJudge, { passive: true });
  root.addEventListener('hha:celebrate', onCelebrate, { passive: true });
  root.addEventListener('groups:stun', onGroupsStun, { passive: true });

  // tiny css-inject for pop
  (function ensureMiniCss() {
    if (doc.getElementById('hha-fx-mini-css')) return;
    const st = doc.createElement('style');
    st.id = 'hha-fx-mini-css';
    st.textContent = `
      html.hha-celebrate-pop { transform: translateZ(0); }
      html.hha-celebrate-pop body { animation: hhaPop .18s ease-out; }
      @keyframes hhaPop{
        from{ filter: brightness(1.0); }
        to  { filter: brightness(1.14); }
      }
    `;
    doc.head.appendChild(st);
  })();

  // expose API
  const API = {
    __bound: true,
    ensureLayer,
    scorePop,
    judgeText,
    burstAt,
    burstOnElement,
    celebrate
  };

  root.Particles = API;
  root.GAME_MODULES.Particles = API;

})(window);