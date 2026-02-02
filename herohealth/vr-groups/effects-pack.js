// === /herohealth/vr-groups/effects-pack.js ===
// GroupsVR Effects Pack — PRODUCTION (SAFE)
// ✅ Hooks: listens to 'groups:hit' => pop/burst effects
// ✅ Uses window.Particles if available, else safe DOM fallback
// ✅ Self-test: add ?selftest=1 to see "FX READY" + demo pings
(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};
  const NS = (WIN.GroupsVR.EffectsPack = WIN.GroupsVR.EffectsPack || {});

  let _layerEl = null;
  let _ready = false;
  let _installed = false;
  let _fallbackLayer = null;
  let _selftest = false;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function ensureFallbackLayer(){
    if(_fallbackLayer && DOC.body.contains(_fallbackLayer)) return _fallbackLayer;
    const d = DOC.createElement('div');
    d.id = 'hha-fx-fallback';
    d.style.cssText = [
      'position:fixed','inset:0','pointer-events:none','z-index:54',
      'contain:layout style paint'
    ].join(';');
    DOC.body.appendChild(d);
    _fallbackLayer = d;
    return d;
  }

  function safeLayer(){
    return _layerEl || DOC.getElementById('playLayer') || DOC.body;
  }

  // --------- Fallback FX (DOM) ----------
  function popDot(x,y, tone){
    const L = ensureFallbackLayer();
    const el = DOC.createElement('div');
    const s = (tone==='good') ? 'rgba(34,197,94,.95)' :
              (tone==='bad')  ? 'rgba(239,68,68,.95)' :
              (tone==='warn') ? 'rgba(245,158,11,.95)' :
                               'rgba(229,231,235,.95)';

    const r = 7;
    el.style.cssText = [
      'position:fixed',
      `left:${Math.round(x-r)}px`,
      `top:${Math.round(y-r)}px`,
      `width:${r*2}px`,
      `height:${r*2}px`,
      `border-radius:${r*2}px`,
      `background:${s}`,
      'opacity:.0',
      'transform:scale(.6)',
      'filter:drop-shadow(0 10px 14px rgba(0,0,0,.28))'
    ].join(';');
    L.appendChild(el);

    requestAnimationFrame(()=>{
      el.style.transition = 'transform 140ms ease, opacity 120ms ease';
      el.style.opacity = '1';
      el.style.transform = 'scale(1.25)';
    });

    setTimeout(()=>{
      try{
        el.style.transition = 'transform 220ms ease, opacity 220ms ease';
        el.style.opacity = '0';
        el.style.transform = 'scale(.8)';
      }catch(_){}
    }, 120);

    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 430);
  }

  function popText(x,y, text, tone){
    const L = ensureFallbackLayer();
    const el = DOC.createElement('div');
    const c = (tone==='good') ? 'rgba(34,197,94,.98)' :
              (tone==='bad')  ? 'rgba(239,68,68,.98)' :
              (tone==='warn') ? 'rgba(245,158,11,.98)' :
                               'rgba(229,231,235,.98)';
    el.textContent = text;
    el.style.cssText = [
      'position:fixed',
      `left:${Math.round(x)}px`,
      `top:${Math.round(y)}px`,
      'transform:translate(-50%,-50%) translateY(6px) scale(.96)',
      'opacity:0',
      'font-weight:1100',
      'font-size:13px',
      `color:${c}`,
      'text-shadow:0 10px 24px rgba(0,0,0,.36)',
      'padding:6px 10px',
      'border-radius:999px',
      'background:rgba(2,6,23,.45)',
      'border:1px solid rgba(148,163,184,.18)',
      'backdrop-filter:blur(8px)'
    ].join(';');
    L.appendChild(el);

    requestAnimationFrame(()=>{
      el.style.transition = 'transform 160ms ease, opacity 140ms ease';
      el.style.opacity = '1';
      el.style.transform = 'translate(-50%,-50%) translateY(0px) scale(1)';
    });

    setTimeout(()=>{
      try{
        el.style.transition = 'transform 260ms ease, opacity 260ms ease';
        el.style.opacity = '0';
        el.style.transform = 'translate(-50%,-50%) translateY(-10px) scale(.98)';
      }catch(_){}
    }, 520);

    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 900);
  }

  function burst(x,y, tone){
    const n = 10;
    for(let i=0;i<n;i++){
      const a = (Math.PI*2) * (i/n);
      const dx = Math.cos(a) * (10 + Math.random()*18);
      const dy = Math.sin(a) * (10 + Math.random()*18);
      popDot(x + dx, y + dy, tone);
    }
  }

  // --------- Particles wrapper ----------
  function hasParticles(){
    return !!(WIN.Particles && (WIN.Particles.popText || WIN.Particles.pop));
  }

  function fxPop(x,y, text, tone){
    x = clamp(x, 0, Math.max(320, WIN.innerWidth||360));
    y = clamp(y, 0, Math.max(480, WIN.innerHeight||640));
    if(hasParticles()){
      try{
        const cls =
          (tone==='good') ? 'fx-good' :
          (tone==='bad')  ? 'fx-bad' :
          (tone==='warn') ? 'fx-warn' : 'fx-neutral';
        (WIN.Particles.popText || WIN.Particles.pop)(x, y, text, cls);
        return;
      }catch(_){}
    }
    popText(x,y,text,tone);
  }

  function fxBurst(x,y, tone){
    x = clamp(x, 0, Math.max(320, WIN.innerWidth||360));
    y = clamp(y, 0, Math.max(480, WIN.innerHeight||640));
    if(hasParticles()){
      try{
        if(WIN.Particles.burst) WIN.Particles.burst(x,y,{});
        else (WIN.Particles.popText || WIN.Particles.pop)(x, y, '✨', 'fx-neutral');
        return;
      }catch(_){}
    }
    burst(x,y,tone);
  }

  // --------- Event handler ----------
  function onHit(ev){
    const d = (ev && ev.detail) ? ev.detail : {};
    const x = Number(d.x)||0;
    const y = Number(d.y)||0;

    const kind = String(d.kind||'').toLowerCase();
    const good = !!d.good;
    const miss = !!d.miss;

    if(kind === 'hit_good' || (good && !miss)){
      fxBurst(x,y,'good');
      fxPop(x,y,'✅','good');
    }else if(kind === 'hit_bad'){
      fxBurst(x,y,'bad');
      fxPop(x,y,'❌','bad');
    }else if(kind === 'shot_miss'){
      fxPop(x,y,'⚠️','warn');
    }else if(kind === 'timeout_miss'){
      fxPop(x,y,'⌛','warn');
    }else{
      fxPop(x,y, good ? '✅' : '⚠️', good ? 'good' : 'warn');
    }
  }

  function banner(text){
    // safe top banner-ish ping
    const w = (WIN.innerWidth||360);
    const x = Math.max(26, Math.min(w-26, w/2));
    const y = 70;
    fxPop(x,y, text, 'neutral');
  }

  function installOnce(){
    if(_installed) return;
    _installed = true;
    WIN.addEventListener('groups:hit', onHit, { passive:true });
  }

  // --------- Public API ----------
  NS.init = function init(opts={}){
    _layerEl = opts.layerEl || _layerEl || DOC.getElementById('playLayer') || DOC.body;
    installOnce();

    _selftest = String(qs('selftest','0')||'0') === '1';
    _ready = true;

    if(_selftest){
      setTimeout(()=>{ banner('FX READY'); }, 200);
      setTimeout(()=>{ fxPop((WIN.innerWidth||360)*0.35, (WIN.innerHeight||640)*0.48, '✅', 'good'); }, 600);
      setTimeout(()=>{ fxPop((WIN.innerWidth||360)*0.50, (WIN.innerHeight||640)*0.48, '❌', 'bad'); }, 900);
      setTimeout(()=>{ fxPop((WIN.innerWidth||360)*0.65, (WIN.innerHeight||640)*0.48, '⚠️', 'warn'); }, 1200);
    }

    return true;
  };

  NS.isReady = ()=>!!_ready;

})();