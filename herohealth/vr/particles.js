// === /herohealth/vr/particles.js ===
// HeroHealth FX Layer (PRODUCTION / SAFE)
// - scorePop(x,y,txt,label)
// - burstAt(x,y,mode)
// - celebrate({kind,intensity})
// - toast(text, ms)
// + FloatingPop HARD MODE (fever-scaled + trail + micro-shake)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // ---------- layer ----------
  function ensureLayer() {
    let layer = doc.querySelector('.hha-fx-layer');
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'hha-fx-layer';
      Object.assign(layer.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '999',
        pointerEvents: 'none',
        overflow: 'hidden'
      });
      doc.body.appendChild(layer);
    }
    ensureCSS();
    return layer;
  }

  // ---------- fever cache (for intensity) ----------
  let __HHA_FEVER__ = 0;
  root.addEventListener('hha:fever', (e)=>{
    const d = e.detail || {};
    const f = Number(d.fever ?? d.feverPct ?? 0);
    if (Number.isFinite(f)) __HHA_FEVER__ = Math.max(0, Math.min(100, f));
  });
  function fever01(){ return Math.max(0, Math.min(1, (__HHA_FEVER__||0)/100)); }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // ---------- CSS ----------
  let _cssDone = false;
  function ensureCSS() {
    if (_cssDone) return;
    _cssDone = true;

    const st = doc.createElement('style');
    st.textContent = `
/* ===== HeroHealth FX Layer ===== */
.hha-scorepop, .hha-toast, .hha-burst, .hha-floatpop, .hha-floatpop-trail{
  font-family: system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.hha-scorepop{
  position:absolute;
  transform: translate(-50%,-50%);
  opacity:0;
  padding:8px 12px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.14);
  background: rgba(2,6,23,.20);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 50px rgba(0,0,0,.45);
  font-weight:1000;
  letter-spacing:.02em;
  white-space:nowrap;
  will-change: transform, opacity;
}
.hha-scorepop.show{ animation: hhaScorePop 760ms cubic-bezier(.16,.95,.25,1) both; }
@keyframes hhaScorePop{
  0%{ opacity:0; transform:translate(-50%,-50%) scale(.82); }
  16%{ opacity:1; transform:translate(-50%,-66%) scale(1.06); }
  60%{ opacity:1; transform:translate(-50%,-98%) scale(1.0); }
  100%{ opacity:0; transform:translate(-50%,-132%) scale(.98); }
}
.hha-scorepop .t{ font-size:16px; }
.hha-scorepop .l{ font-size:11px; opacity:.85; margin-left:8px; }

/* burst */
.hha-burst{
  position:absolute;
  width:10px;height:10px;
  transform: translate(-50%,-50%);
  opacity:0;
  border-radius:999px;
  box-shadow: 0 0 0 0 rgba(255,255,255,.0);
}
.hha-burst.show{ animation: hhaBurst 520ms ease-out both; }
@keyframes hhaBurst{
  0%{ opacity:0; transform:translate(-50%,-50%) scale(.6); }
  25%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
  100%{ opacity:0; transform:translate(-50%,-50%) scale(3.6); }
}

/* toast */
.hha-toast{
  position:fixed;
  left:50%;
  bottom:18px;
  transform: translate(-50%, 0);
  padding:10px 12px;
  border-radius:16px;
  border:1px solid rgba(148,163,184,.18);
  background: rgba(2,6,23,.72);
  color: rgba(229,231,235,.95);
  box-shadow: 0 18px 50px rgba(0,0,0,.45);
  backdrop-filter: blur(10px);
  font-weight:900;
  font-size:13px;
  opacity:0;
  z-index: 1000;
}
.hha-toast.show{ animation: hhaToast 1600ms ease-in-out both; }
@keyframes hhaToast{
  0%{ opacity:0; transform:translate(-50%, 8px); }
  12%{ opacity:1; transform:translate(-50%, 0); }
  80%{ opacity:1; transform:translate(-50%, 0); }
  100%{ opacity:0; transform:translate(-50%, 8px); }
}

/* ===== FLOATINGPOP (HARD MODE) ===== */
body.hha-microshake{ animation: hhaMicroShake .14s linear; }
@keyframes hhaMicroShake{
  0%{ transform:translate(0,0) }
  20%{ transform:translate(-2px,1px) }
  40%{ transform:translate(2px,-1px) }
  60%{ transform:translate(-2px,-1px) }
  80%{ transform:translate(2px,1px) }
  100%{ transform:translate(0,0) }
}

.hha-floatpop{
  position:absolute;
  transform: translate(-50%,-50%);
  opacity:0;
  pointer-events:none;
  font-weight:1000;
  letter-spacing:.02em;
  white-space:nowrap;
  padding: 8px 12px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.12);
  background: rgba(2,6,23,.22);
  backdrop-filter: blur(10px);
  box-shadow: 0 18px 50px rgba(0,0,0,.45);
  will-change: transform, opacity, filter;
}
.hha-floatpop[data-size="big"]{ font-size:18px; padding:10px 14px; }
.hha-floatpop[data-size="small"]{ font-size:13px; }

.hha-floatpop.show{
  animation: hhaFloatPopHard var(--dur,720ms) cubic-bezier(.16,.95,.25,1) both;
}
@keyframes hhaFloatPopHard{
  0%{
    opacity:0;
    transform: translate(-50%,-50%) scale(.86);
    filter: drop-shadow(0 8px 18px rgba(0,0,0,.35));
  }
  14%{
    opacity:1;
    transform: translate(calc(-50% + var(--jit,2px)), -64%) scale(calc(1.06 * var(--amp,1)));
  }
  32%{
    opacity:1;
    transform: translate(calc(-50% - var(--jit,2px)), -86%) scale(calc(1.02 * var(--amp,1)));
  }
  58%{
    opacity:1;
    transform: translate(calc(-50% + (var(--jit,2px)*.6)), -110%) scale(1.00);
  }
  100%{
    opacity:0;
    transform: translate(-50%,-150%) scale(.98);
  }
}

/* afterimage trail */
.hha-floatpop-trail{
  position:absolute;
  transform: translate(-50%,-50%) scale(.92);
  opacity:0;
  pointer-events:none;
  font-weight:1000;
  letter-spacing:.02em;
  white-space:nowrap;
  padding: 8px 12px;
  border-radius:999px;
  border:1px solid rgba(148,163,184,.12);
  background: rgba(2,6,23,.18);
  backdrop-filter: blur(10px);
  filter: blur(.2px) drop-shadow(0 14px 28px rgba(0,0,0,.35));
  will-change: transform, opacity;
  mix-blend-mode: screen;
}
.hha-floatpop-trail.show{ animation: hhaFloatTrail var(--dur,680ms) ease-out both; }
@keyframes hhaFloatTrail{
  0%   { opacity:0; transform: translate(-50%,-50%) scale(.92); }
  18%  { opacity:.55; transform: translate(-50%,-72%) scale(1.02); }
  65%  { opacity:.25; transform: translate(-50%,-108%) scale(1.00); }
  100% { opacity:0; transform: translate(-50%,-142%) scale(.98); }
}

/* glow / boss */
.hha-floatpop[data-fx="glow"]{
  box-shadow: 0 0 0 1px rgba(245,158,11,.18), 0 18px 60px rgba(245,158,11,.18);
  filter: drop-shadow(0 0 18px rgba(245,158,11,.25)) drop-shadow(0 18px 40px rgba(0,0,0,.45));
}
.hha-floatpop[data-fx="boss"]{
  box-shadow: 0 0 0 1px rgba(251,113,133,.22), 0 22px 70px rgba(251,113,133,.20);
  filter: drop-shadow(0 0 22px rgba(251,113,133,.22)) drop-shadow(0 18px 40px rgba(0,0,0,.45));
}
`;
    doc.head.appendChild(st);
  }

  // ---------- core fx ----------
  function burstAt(x, y, mode = 'good') {
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-burst';

    // mode tint (no hard colors requested; keep subtle via box-shadow intensity only)
    const m = String(mode || 'good').toLowerCase();
    let glow = 'rgba(255,255,255,.20)';
    if (m.includes('trap') || m.includes('bad')) glow = 'rgba(251,113,133,.22)';
    else if (m.includes('gold')) glow = 'rgba(245,158,11,.20)';
    else if (m.includes('power')) glow = 'rgba(59,130,246,.20)';

    el.style.left = (x | 0) + 'px';
    el.style.top = (y | 0) + 'px';
    el.style.boxShadow = `0 0 0 0 ${glow}`;
    layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 560);
  }

  function scorePop(x, y, txt, label = '') {
    const layer = ensureLayer();
    const el = doc.createElement('div');
    el.className = 'hha-scorepop';
    el.style.left = (x | 0) + 'px';
    el.style.top = (y | 0) + 'px';

    const t = doc.createElement('span');
    t.className = 't';
    t.textContent = String(txt || '');
    el.appendChild(t);

    if (label) {
      const l = doc.createElement('span');
      l.className = 'l';
      l.textContent = String(label || '');
      el.appendChild(l);
    }

    layer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 900);
  }

  function toast(text, ms = 1600) {
    ensureLayer(); // ensure css
    const el = doc.createElement('div');
    el.className = 'hha-toast';
    el.textContent = String(text || '');
    doc.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { try { el.remove(); } catch (_) {} }, Math.max(900, ms | 0));
  }

  function celebrate(opts = {}) {
    // lightweight celebration: burst at center + toast
    try {
      const kind = String(opts.kind || 'OK');
      const intensity = clamp(opts.intensity ?? 1, 0.6, 2.2);
      const x = (innerWidth * 0.5) | 0;
      const y = (innerHeight * 0.38) | 0;
      for (let i = 0; i < Math.round(2 + intensity * 2); i++) {
        burstAt(x + (Math.random() * 120 - 60), y + (Math.random() * 90 - 45), kind.toLowerCase().includes('boss') ? 'gold' : 'good');
      }
      toast(kind, 1200);
    } catch (_) {}
  }

  // ---------- FLOATINGPOP (HARD MODE) ----------
  function floatPop(x, y, text, kind = 'info', size = 'small', ms = 720, dx = 0) {
    try {
      const layer = ensureLayer();

      const el = doc.createElement('div');
      el.className = 'hha-floatpop';
      el.textContent = String(text || '');

      const k = String(kind || 'info').toLowerCase();
      el.dataset.kind = k;

      const big = String(size || 'small').toLowerCase() === 'big';
      el.dataset.size = big ? 'big' : 'small';

      // intensity based on FEVER
      const f = fever01();          // 0..1
      const amp = 1 + f * 1.1;      // 1..2.1
      const dur = Math.max(340, (ms | 0));
      const dur2 = Math.round(dur * (1 - f * 0.12));

      el.style.left = ((x | 0) + (dx | 0)) + 'px';
      el.style.top = (y | 0) + 'px';
      el.style.setProperty('--dur', dur2 + 'ms');
      el.style.setProperty('--amp', amp.toFixed(2));
      el.style.setProperty('--jit', (2 + f * 6).toFixed(1) + 'px');

      const isGold = (k === 'gold');
      const isBoss = (k === 'boss' || String(text || '').toUpperCase().includes('BOSS'));
      el.dataset.fx = isGold ? 'glow' : (isBoss ? 'boss' : 'none');

      // trail for gold/boss or high fever
      const wantTrail = isGold || isBoss || f >= 0.55;
      if (wantTrail) {
        const trail = doc.createElement('div');
        trail.className = 'hha-floatpop-trail';
        trail.dataset.kind = k;
        trail.dataset.fx = el.dataset.fx;
        trail.textContent = el.textContent;
        trail.style.left = el.style.left;
        trail.style.top = el.style.top;
        trail.style.setProperty('--dur', Math.round(dur2 * 0.92) + 'ms');
        trail.style.setProperty('--amp', (amp * 0.96).toFixed(2));
        layer.appendChild(trail);
        requestAnimationFrame(() => trail.classList.add('show'));
        setTimeout(() => { try { trail.remove(); } catch (_) {} }, Math.round(dur2 * 0.92) + 120);
      }

      // micro-shake
      const wantShake = (f >= 0.65) || (k === 'bad');
      if (wantShake) {
        doc.body.classList.add('hha-microshake');
        setTimeout(() => { try { doc.body.classList.remove('hha-microshake'); } catch (_) {} }, 140);
      }

      layer.appendChild(el);
      requestAnimationFrame(() => el.classList.add('show'));
      setTimeout(() => { try { el.remove(); } catch (_) {} }, dur2 + 140);
    } catch (_) {}
  }

  // ---------- event bridges ----------
  // allow game code to do: dispatchEvent('hha:floatpop', {text,kind,size,ms,x,y,dx})
  root.addEventListener('hha:floatpop', (e) => {
    const d = e.detail || {};
    const x = (d.x !== undefined) ? Number(d.x) : innerWidth * 0.5;
    const y = (d.y !== undefined) ? Number(d.y) : innerHeight * 0.42;
    floatPop(x, y, d.text || '', d.kind || 'info', d.size || 'small', d.ms || 720, d.dx || 0);
  });

  // optional: judge -> floatpop (ถ้าอยากให้เด้งเอง)
  root.addEventListener('hha:judge', (e) => {
    const d = e.detail || {};
    const label = String(d.label || '');
    if (!label) return;
    // center-ish pop
    floatPop(innerWidth * 0.5, innerHeight * 0.46, label, /miss|hit|bad/i.test(label) ? 'bad' : 'good', 'small', 620, 0);
  });

  // export
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = { burstAt, scorePop, celebrate, toast, floatPop };

  // also expose legacy global
  root.Particles = root.GAME_MODULES.Particles;

})(window);