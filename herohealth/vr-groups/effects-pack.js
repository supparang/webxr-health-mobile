// === /herohealth/vr-groups/effects-pack.js ===
// Effects Pack — PRODUCTION (GroupsVR)
// ✅ FX layer (DOM) pointer-events:none
// ✅ Uses window.Particles if available, else fallback DOM FX
// ✅ Hooks: hha:judge / hha:celebrate / groups:progress
// ✅ Safe + throttled (mobile-friendly)
// ✅ Disable via ?fx=0, force via ?fx=1

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_GROUPS_FX_LOADED__) return;
  WIN.__HHA_GROUPS_FX_LOADED__ = true;

  // Namespace
  WIN.GroupsVR = WIN.GroupsVR || {};

  // -------- helpers --------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  function fxEnabled(){
    const v = String(qs('fx','')||'').toLowerCase();
    if (v === '0' || v === 'off' || v === 'false') return false;
    if (v === '1' || v === 'on'  || v === 'true')  return true;
    return true; // default ON
  }

  // -------- FX Layer --------
  function ensureFxLayer(){
    let el = DOC.getElementById('hha-fx');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'hha-fx';
    el.style.position = 'fixed';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = '100%';
    el.style.height = '100%';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '85'; // above playLayer, below overlays
    el.style.overflow = 'hidden';
    el.style.contain = 'layout paint';
    DOC.body.appendChild(el);

    return el;
  }

  function addCssOnce(){
    if (DOC.getElementById('hha-fx-css')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-fx-css';
    st.textContent = `
      #hha-fx .fxText{
        position:absolute;
        transform: translate(-50%,-50%);
        font: 1000 13px/1.1 system-ui,-apple-system,"Noto Sans Thai",Segoe UI,sans-serif;
        padding:8px 10px;
        border-radius:999px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.60);
        color: rgba(229,231,235,.94);
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 44px rgba(0,0,0,.30);
        opacity:0;
        animation: hhaFxPop .72s ease forwards;
        white-space: nowrap;
      }
      #hha-fx .fxText.good{ border-color: rgba(34,197,94,.42); }
      #hha-fx .fxText.warn{ border-color: rgba(245,158,11,.45); }
      #hha-fx .fxText.bad { border-color: rgba(239,68,68,.45); }

      @keyframes hhaFxPop{
        0%{ opacity:0; transform: translate(-50%,-40%) scale(.92); }
        18%{ opacity:1; transform: translate(-50%,-55%) scale(1.00); }
        100%{ opacity:0; transform: translate(-50%,-72%) scale(.98); }
      }

      #hha-fx .fxRing{
        position:absolute;
        left:0; top:0;
        width:10px; height:10px;
        transform: translate(-50%,-50%);
        border-radius:999px;
        border:2px solid rgba(34,211,238,.55);
        box-shadow: 0 0 0 2px rgba(2,6,23,.25) inset;
        opacity:0;
        animation: hhaFxRing .42s ease-out forwards;
      }
      #hha-fx .fxRing.good{ border-color: rgba(34,197,94,.55); }
      #hha-fx .fxRing.bad { border-color: rgba(239,68,68,.55); }
      #hha-fx .fxRing.warn{ border-color: rgba(245,158,11,.55); }

      @keyframes hhaFxRing{
        0%{ opacity:0; transform: translate(-50%,-50%) scale(.6); }
        10%{ opacity:1; }
        100%{ opacity:0; transform: translate(-50%,-50%) scale(2.4); }
      }

      .hha-shake{
        animation: hhaShake .18s ease-in-out 1;
      }
      @keyframes hhaShake{
        0%{ transform: translate3d(0,0,0); }
        25%{ transform: translate3d(2px,-1px,0); }
        50%{ transform: translate3d(-2px,1px,0); }
        75%{ transform: translate3d(1px,2px,0); }
        100%{ transform: translate3d(0,0,0); }
      }
    `;
    DOC.head.appendChild(st);
  }

  // -------- fallback primitives --------
  function popText(x,y,text,cls){
    if (!fxEnabled()) return;
    const layer = ensureFxLayer();
    addCssOnce();

    const t = DOC.createElement('div');
    t.className = 'fxText ' + (cls||'');
    t.textContent = String(text||'');
    t.style.left = (Number(x)||0) + 'px';
    t.style.top  = (Number(y)||0) + 'px';
    layer.appendChild(t);

    setTimeout(()=>{ try{ t.remove(); }catch(_){} }, 900);
  }

  function ring(x,y,cls){
    if (!fxEnabled()) return;
    const layer = ensureFxLayer();
    addCssOnce();

    const r = DOC.createElement('div');
    r.className = 'fxRing ' + (cls||'');
    r.style.left = (Number(x)||0) + 'px';
    r.style.top  = (Number(y)||0) + 'px';
    r.style.width = '16px';
    r.style.height = '16px';
    layer.appendChild(r);

    setTimeout(()=>{ try{ r.remove(); }catch(_){} }, 520);
  }

  function shake(){
    if (!fxEnabled()) return;
    DOC.body.classList.remove('hha-shake');
    // force reflow
    void DOC.body.offsetHeight;
    DOC.body.classList.add('hha-shake');
    setTimeout(()=>{ try{ DOC.body.classList.remove('hha-shake'); }catch(_){} }, 260);
  }

  // -------- public API --------
  const FX = {
    enabled: fxEnabled(),

    // Prefer Particles if present
    popText(x,y,text,cls){
      if (!fxEnabled()) return;
      try{
        if (WIN.Particles && typeof WIN.Particles.popText === 'function'){
          // map class to particles theme lightly
          WIN.Particles.popText(x,y,text,cls);
          return;
        }
      }catch(_){}
      popText(x,y,text,cls);
    },

    ring(x,y,cls){
      ring(x,y,cls);
    },

    good(x,y,msg='✅ ถูก!'){
      this.ring(x,y,'good');
      this.popText(x,y,msg,'good');
    },

    bad(x,y,msg='❌ ผิด!'){
      this.ring(x,y,'bad');
      this.popText(x,y,msg,'bad');
      shake();
    },

    warn(x,y,msg='⚠️'){
      this.ring(x,y,'warn');
      this.popText(x,y,msg,'warn');
    },

    celebrate(){
      if (!fxEnabled()) return;
      // use Particles burst if available
      try{
        if (WIN.Particles && typeof WIN.Particles.burst === 'function'){
          const w = WIN.innerWidth||360, h = WIN.innerHeight||640;
          WIN.Particles.burst(w*0.5, h*0.38, { count: 18, spread: 90, ttl: 900 });
          WIN.Particles.burst(w*0.5, h*0.46, { count: 14, spread: 80, ttl: 900 });
          return;
        }
      }catch(_){}
      // fallback text
      const w = WIN.innerWidth||360, h = WIN.innerHeight||640;
      popText(w*0.5, h*0.40, '🎉 เยี่ยมมาก!', 'good');
    }
  };

  // expose
  WIN.GroupsVR.Effects = FX;

  // -------- event hooks (defensive) --------
  let lastFxAt = 0;
  function throttle(ms){
    const t = nowMs();
    if (t - lastFxAt < ms) return false;
    lastFxAt = t;
    return true;
  }

  // Standard judge: ok / x / y
  WIN.addEventListener('hha:judge', (ev)=>{
    if (!fxEnabled()) return;
    if (!throttle(35)) return;

    const d = ev.detail || {};
    const ok = !!d.ok;
    const x = Number(d.x ?? d.clientX ?? (WIN.innerWidth*0.5)) || (WIN.innerWidth*0.5);
    const y = Number(d.y ?? d.clientY ?? (WIN.innerHeight*0.5)) || (WIN.innerHeight*0.5);

    if (ok){
      FX.good(x,y, d.text || '✅ ถูก!');
    }else{
      FX.bad(x,y, d.text || '❌ ผิด!');
    }
  }, { passive:true });

  // When game ends / win moments
  WIN.addEventListener('hha:celebrate', ()=>{
    FX.celebrate();
  }, { passive:true });

  // Progress moments from Groups engine
  WIN.addEventListener('groups:progress', (ev)=>{
    if (!fxEnabled()) return;
    const d = ev.detail || {};
    const k = String(d.kind||'');
    const w = WIN.innerWidth||360, h = WIN.innerHeight||640;

    if (k === 'storm_on')  FX.warn(w*0.5, h*0.30, '🌪️ STORM!');
    if (k === 'storm_off') FX.good(w*0.5, h*0.30, '✨ พายุจบ!');
    if (k === 'boss_spawn')FX.warn(w*0.5, h*0.30, '👊 BOSS!');
    if (k === 'boss_down'){ FX.celebrate(); }
  }, { passive:true });

  // tiny sanity ping for debugging (optional)
  try{
    WIN.dispatchEvent(new CustomEvent('groups:fx_ready', { detail:{ ok:true, fx: fxEnabled() ? 'on':'off' } }));
  }catch(_){}
})();