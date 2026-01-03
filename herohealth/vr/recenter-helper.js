// === /herohealth/vr/recenter-helper.js ===
// HeroHealth — Recenter / Calibration Helper (Cardboard + cVR + Mobile)
// ✅ Long-press anywhere (default 650ms) => recenter
// ✅ Optional button mount (top-right) if you want
// ✅ Emits: hha:recenter {reason, view, ts}
// ✅ Provides hook to integrate with touch-look / gyro / translate-based playfields
// ✅ Does NOT change pointer-events; safe for view-cvr strict

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

export function createRecenterHelper(opts={}){
  const cfg = {
    // where to listen
    rootEl: opts.rootEl || DOC.body,
    // optional: element to avoid triggering long-press (HUD buttons)
    ignoreSelector: opts.ignoreSelector || '#hudBtns, .btnRow, button, a, input, textarea, [data-no-recenter]',
    // behavior
    enabled: (opts.enabled !== false),
    holdMs: clamp(opts.holdMs ?? 650, 350, 1800),
    vibMs: clamp(opts.vibMs ?? 18, 0, 60),
    // overlay
    showOverlay: (opts.showOverlay !== false),
    overlayText: opts.overlayText || 'CALIBRATE',
    overlaySub: opts.overlaySub || 'แตะค้างเพื่อรีเซ็นเตอร์',
    // callback to actually reset your control system
    onRecenter: (typeof opts.onRecenter === 'function') ? opts.onRecenter : null,
  };

  const S = {
    pressing:false,
    pressT:0,
    timer:0,
    lastFire:0
  };

  // detect view
  function view(){
    const b = DOC.body;
    if (b.classList.contains('cardboard')) return 'cardboard';
    if (b.classList.contains('view-cvr')) return 'cvr';
    if (b.classList.contains('view-mobile')) return 'mobile';
    return 'pc';
  }

  // overlay
  let overlay=null;
  function ensureOverlay(){
    if (!cfg.showOverlay) return null;
    if (overlay && overlay.isConnected) return overlay;

    const el = DOC.createElement('div');
    el.id = 'hhaRecenterOverlay';
    el.style.cssText = `
      position:fixed;
      left:50%; top:16%;
      transform:translate(-50%,-50%);
      z-index:9998;
      pointer-events:none;
      opacity:0;
      transition: opacity 160ms ease, transform 160ms ease;
      padding:10px 12px;
      border-radius:16px;
      border:1px solid rgba(148,163,184,.22);
      background:rgba(2,6,23,.78);
      color:rgba(229,231,235,.95);
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      text-align:center;
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 70px rgba(0,0,0,.40);
    `;
    el.innerHTML = `
      <div style="font-weight:900; letter-spacing:.2px; font-size:13px">${cfg.overlayText}</div>
      <div style="margin-top:4px; opacity:.85; font-size:12px">${cfg.overlaySub}</div>
      <div id="hhaRecenterBar" style="margin-top:8px;height:8px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden;border:1px solid rgba(148,163,184,.12)">
        <div style="height:100%;width:0%;background:linear-gradient(90deg, rgba(34,211,238,.95), rgba(34,197,94,.95))"></div>
      </div>
    `;
    DOC.body.appendChild(el);
    overlay = el;
    return overlay;
  }
  function setOverlay(pct, visible){
    const el = ensureOverlay();
    if (!el) return;
    const bar = el.querySelector('#hhaRecenterBar > div');
    if (bar) bar.style.width = `${clamp(pct,0,100).toFixed(0)}%`;
    el.style.opacity = visible ? '1' : '0';
    el.style.transform = visible ? 'translate(-50%,-50%) scale(1.0)' : 'translate(-50%,-60%) scale(0.98)';
  }

  function canTriggerFrom(ev){
    try{
      const t = ev.target;
      if (!t) return true;
      if (cfg.ignoreSelector && t.closest && t.closest(cfg.ignoreSelector)) return false;
    }catch(_){}
    return true;
  }

  function vibrate(){
    try{
      if (cfg.vibMs > 0 && navigator.vibrate) navigator.vibrate(cfg.vibMs);
    }catch(_){}
  }

  function fire(reason='hold'){
    const now = performance.now();
    if (now - S.lastFire < 250) return;
    S.lastFire = now;

    vibrate();
    setOverlay(100, true);
    setTimeout(()=>setOverlay(0, false), 260);

    const info = { reason, view: view(), ts: Date.now() };
    emit('hha:recenter', info);

    try{ cfg.onRecenter && cfg.onRecenter(info); }catch(_){}
  }

  function startPress(ev){
    if (!cfg.enabled) return;
    if (!canTriggerFrom(ev)) return;

    S.pressing = true;
    S.pressT = performance.now();
    setOverlay(0, true);

    clearTimeout(S.timer);
    S.timer = setTimeout(()=>fire('hold'), cfg.holdMs);
  }
  function endPress(){
    if (!S.pressing) return;
    S.pressing = false;
    clearTimeout(S.timer);
    S.timer = 0;
    setOverlay(0, false);
  }

  // progress fill while holding
  function rafTick(){
    if (!cfg.enabled) return;
    if (S.pressing){
      const dt = performance.now() - S.pressT;
      const pct = clamp((dt/cfg.holdMs)*100, 0, 100);
      setOverlay(pct, true);
    }
    requestAnimationFrame(rafTick);
  }
  requestAnimationFrame(rafTick);

  // listeners
  const el = cfg.rootEl || DOC.body;
  el.addEventListener('pointerdown', startPress, {passive:true});
  el.addEventListener('pointerup', endPress, {passive:true});
  el.addEventListener('pointercancel', endPress, {passive:true});
  el.addEventListener('pointerleave', endPress, {passive:true});

  // key shortcut (PC)
  window.addEventListener('keydown', (e)=>{
    if (!cfg.enabled) return;
    if (e.key === 'r' || e.key === 'R'){
      fire('key');
    }
  });

  return {
    fire,
    destroy(){
      try{
        el.removeEventListener('pointerdown', startPress);
        el.removeEventListener('pointerup', endPress);
        el.removeEventListener('pointercancel', endPress);
        el.removeEventListener('pointerleave', endPress);
      }catch(_){}
      try{ if (overlay) overlay.remove(); }catch(_){}
    }
  };
}