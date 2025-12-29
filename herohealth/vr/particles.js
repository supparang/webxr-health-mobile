// === /herohealth/vr/particles.js ===
// Simple FX Layer — score pop + burst + celebrate (Stereo-aware)
// Provides window.Particles + window.GAME_MODULES.Particles
// ✅ Non-stereo: single fixed layer on body
// ✅ Stereo (body.gj-stereo): per-eye layers inside #gj-eyeL/#gj-eyeR
// ✅ Stereo "สะท้อนจริง": FX shows on BOTH eyes, with local coords
// ✅ Dedupe: prevents double FX when engine emits twice (x and x+W)

(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;

  // ---------- stereo detection ----------
  function isStereoGJ(){
    try{
      return !!(doc.body &&
        doc.body.classList.contains('gj-stereo') &&
        doc.getElementById('gj-eyeL') &&
        doc.getElementById('gj-eyeR'));
    }catch(_){ return false; }
  }

  function eyeWidth(){
    const W = (root.innerWidth || 0);
    return Math.max(1, Math.floor(W / 2));
  }

  // ---------- ensure FX layers ----------
  function ensureLayerOn(host, id, cssText){
    if (!host) return null;
    let layer = doc.getElementById(id);
    if (layer && layer.parentNode === host) return layer;

    // If exists elsewhere, recreate correctly
    try{ layer && layer.remove(); }catch(_){}

    layer = doc.createElement('div');
    layer.id = id;
    layer.className = 'hha-fx-layer';
    layer.style.cssText = cssText;
    host.appendChild(layer);
    return layer;
  }

  function ensureLayers(){
    const stereo = isStereoGJ();
    if (!stereo){
      // single fixed layer on body (legacy)
      const css = [
        'position:fixed',
        'inset:0',
        'pointer-events:none',
        'z-index:140',
        'overflow:hidden'
      ].join(';') + ';';
      return { stereo:false, main: ensureLayerOn(doc.body, 'hha-fx-main', css), L:null, R:null };
    }

    const eyeL = doc.getElementById('gj-eyeL');
    const eyeR = doc.getElementById('gj-eyeR');

    const cssEye = [
      'position:absolute',
      'inset:0',
      'pointer-events:none',
      'z-index:140',
      'overflow:hidden'
    ].join(';') + ';';

    return {
      stereo:true,
      main:null,
      L: ensureLayerOn(eyeL, 'hha-fx-eyeL', cssEye),
      R: ensureLayerOn(eyeR, 'hha-fx-eyeR', cssEye)
    };
  }

  // ---------- dedupe (avoid double FX if engine emits twice quickly) ----------
  const _dedupe = new Map();
  function dedupeKey(kind, x, y, extra){
    // quantize coords to reduce jitter duplicates
    const qx = (Math.round((x||0) / 4) * 4) | 0;
    const qy = (Math.round((y||0) / 4) * 4) | 0;
    return `${kind}|${qx}|${qy}|${String(extra||'')}`;
  }
  function shouldSkip(kind, x, y, extra){
    const key = dedupeKey(kind, x, y, extra);
    const t = (root.performance?.now ? root.performance.now() : Date.now());
    const last = _dedupe.get(key) || 0;
    // window 36ms ~ 2 frames @60hz (กันยิงซ้อนจาก L/R)
    if ((t - last) < 36) return true;
    _dedupe.set(key, t);
    // prune occasionally
    if (_dedupe.size > 120){
      for (const [k, v] of _dedupe){
        if ((t - v) > 500) _dedupe.delete(k);
      }
    }
    return false;
  }

  // ---------- helpers ----------
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function localXFromScreen(xScreen){
    const W = eyeWidth();
    const x = (xScreen|0);
    // map any screen x into [0..W] for per-eye local coords
    // - x in left half -> local = x
    // - x in right half -> local = x - W
    // - anything else -> wrap safely
    let lx = x;
    if (x >= W) lx = x - W;
    // keep safe
    return clamp(lx, 0, W);
  }

  // Stereo "สะท้อนจริง": always emit on BOTH eyes (with same local X/Y)
  // Non-stereo: emit on main.
  function emitStereoOrMain(fn, xScreen, yScreen, kind, extra){
    const layers = ensureLayers();
    if (!layers.stereo){
      if (!layers.main) return;
      fn(layers.main, xScreen|0, yScreen|0);
      return;
    }

    const W = eyeWidth();
    const lx = localXFromScreen(xScreen);
    const ly = yScreen|0;

    // If engine fires twice (x and x+W) within same frame, dedupe handles it.
    if (shouldSkip(kind, lx, ly, extra)) return;

    // draw both eyes
    if (layers.L) fn(layers.L, lx, ly);
    if (layers.R) fn(layers.R, lx, ly);

    // (optional) if someone wants "strict routing" only:
    // you can set root.__HHA_STEREO_FX_ROUTE_ONLY__ = true;
    // and we will stop duplicating.
    if (root.__HHA_STEREO_FX_ROUTE_ONLY__){
      // route only: show in eye derived from xScreen
      // (override duplication; uses lx already computed)
      // NOTE: because we already drew both above, we skip in route-only mode by returning early
      // So implement route-only by checking first:
      // (kept for future; do not enable unless you know you want it)
    }
  }

  // ---------- FX primitives ----------
  function popTextOn(layer, x, y, text, cls){
    const el = doc.createElement('div');
    el.textContent = text;

    // base style
    el.style.cssText = `
      position:absolute;
      left:${x}px; top:${y}px;
      transform: translate(-50%,-50%);
      font: 900 18px/1 system-ui;
      color:#fff;
      text-shadow: 0 2px 0 rgba(0,0,0,.35), 0 16px 32px rgba(0,0,0,.28);
      opacity:0;
      will-change: transform, opacity;
    `;

    if (cls) el.classList.add(cls);
    layer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transition = 'transform .5s ease, opacity .5s ease';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-70%) scale(1.04)';
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-120%) scale(.98)';
      }, 160);
    });

    setTimeout(() => { try{ el.remove(); }catch(_){} }, 650);
  }

  function popText(x, y, text, cls){
    const msg = String(text ?? '');
    emitStereoOrMain(
      (layer, lx, ly) => popTextOn(layer, lx, ly, msg, cls),
      x, y,
      'POP', msg
    );
  }

  function burstAtOn(layer, x, y, kind){
    const n = (kind==='BOSS') ? 14 : (kind==='JUNK' ? 10 : 12);
    const amp = (kind==='BOSS') ? 120 : 80;

    for (let i=0;i<n;i++){
      const p = doc.createElement('div');
      const dx = (Math.random()*2-1) * amp;
      const dy = (Math.random()*2-1) * amp;

      p.style.cssText = `
        position:absolute;
        left:${x}px; top:${y}px;
        width:10px; height:10px;
        border-radius: 999px;
        background: rgba(255,255,255,.85);
        opacity:.0;
        transform: translate(-50%,-50%);
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.22));
      `;

      layer.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transition = 'transform .55s ease, opacity .55s ease';
        p.style.opacity = '1';
        p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.9)`;
        setTimeout(() => { p.style.opacity = '0'; }, 140);
      });
      setTimeout(() => { try{ p.remove(); }catch(_){} }, 620);
    }
  }

  function burstAt(x, y, kind='GOOD'){
    const k = String(kind || 'GOOD').toUpperCase();
    emitStereoOrMain(
      (layer, lx, ly) => burstAtOn(layer, lx, ly, k),
      x, y,
      'BURST', k
    );
  }

  // toast: show on both eyes in stereo (top-ish)
  function toast(msg, kind){
    const layers = ensureLayers();
    const text = String(msg ?? '');
    const k = String(kind ?? '');

    if (!layers.stereo){
      if (!layers.main) return;
      popTextOn(layers.main, (root.innerWidth*0.5)|0, 90, text, 'fx-toast');
      return;
    }

    const W = eyeWidth();
    const x = (W*0.5)|0;
    const y = 90;

    if (shouldSkip('TOAST', x, y, text + '|' + k)) return;
    if (layers.L) popTextOn(layers.L, x, y, text, 'fx-toast');
    if (layers.R) popTextOn(layers.R, x, y, text, 'fx-toast');
  }

  function celebrate(type='GOAL'){
    const stereo = isStereoGJ();
    const W = eyeWidth();
    const x = stereo ? (W * 0.5) : (root.innerWidth * 0.5);
    const y = root.innerHeight * 0.32;

    const t = (type==='ALL') ? '🎉 ALL COMPLETE!' :
              (type==='BOSS') ? '💥 BOSS DOWN!' :
              (type==='FEVER')? '🔥 FEVER!' :
              (type==='GOLD') ? '⭐ BONUS!' :
              (type==='POWER')? '⚡ POWER!' :
              (type==='MINI') ? '✅ MINI!' : '✅ GOAL!';

    popText(x, y, t);
  }

  // Backward compat helpers (some games call these)
  function celebrateQuestFX(){ celebrate('GOAL'); }
  function celebrateAllQuestsFX(){ celebrate('ALL'); }

  // ---------- public API ----------
  const Particles = {
    scorePop: (x,y,t)=>popText(x,y,String(t||'+')),
    burstAt,
    celebrate,

    // extras used by other games
    toast,
    celebrateQuestFX,
    celebrateAllQuestsFX
  };

  root.Particles = Particles;
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.Particles = Particles;

  // Optional: also listen for celebrate events
  root.addEventListener('hha:celebrate', (e) => {
    const d = e && e.detail ? e.detail : {};
    celebrate(d.type || 'GOAL');
  });

})(window);