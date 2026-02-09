// === /herohealth/vr-groups/effects-pack.js ===
// GroupsVR Effects Pack — PRODUCTION (PATCH v20260208b)
// ✅ Listens: 'groups:hit'  => { kind, x, y, good, miss }
// ✅ Kinds: hit_good | hit_bad | shot_miss | timeout_miss
// ✅ Uses particles.js if present (window.HHA_Particles) else DOM fallback
// ✅ Rate-limit + cleanup (mobile safe)
// API: window.GroupsVR.EffectsPack.init({ layerEl }), .burst(kind,x,y), .destroy()

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  WIN.GroupsVR = WIN.GroupsVR || {};

  const S = {
    inited:false,
    layerEl:null,
    root:null,
    lastAt:0,
    // throttle per-kind (ms)
    lastKindAt: Object.create(null),
    // counts
    active:0,
    maxActive: 22,
    // config
    cfg:{
      enabled:true,
      throttleMs: 26,
      perKindThrottle:{
        hit_good: 14,
        hit_bad: 22,
        shot_miss: 30,
        timeout_miss: 46
      }
    }
  };

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }

  function getView(){
    const v = String(qs('view','mobile')||'mobile').toLowerCase();
    return v;
  }

  function ensureRoot(){
    if (S.root && DOC.body.contains(S.root)) return;
    const r = DOC.createElement('div');
    r.id = 'groupsFxRoot';
    r.style.cssText =
      'position:fixed; inset:0; pointer-events:none; z-index:60; '+
      'contain:layout style paint;';
    S.root = r;
    DOC.body.appendChild(r);
  }

  function setLayerEl(el){
    S.layerEl = el || S.layerEl || DOC.body;
  }

  function canEmit(kind){
    if (!S.cfg.enabled) return false;
    const t = nowMs();

    // global throttle
    if ((t - S.lastAt) < S.cfg.throttleMs) return false;

    // per-kind throttle
    const pk = S.cfg.perKindThrottle && S.cfg.perKindThrottle[kind];
    if (pk){
      const prev = Number(S.lastKindAt[kind]||0);
      if ((t - prev) < pk) return false;
    }

    S.lastAt = t;
    S.lastKindAt[kind] = t;
    return true;
  }

  // -------------------- particles bridge --------------------
  function particleBurst(kind, x, y){
    try{
      const P = WIN.HHA_Particles;
      if (!P || typeof P.burst !== 'function') return false;

      // tune by kind
      const view = getView();
      const scale = (view==='pc') ? 1.05 : (view==='cvr' ? 1.10 : 1.0);

      if (kind === 'hit_good'){
        P.burst({ x, y, count: Math.round(14*scale), spread: 0.92, speed: 1.15, life: 520, gravity: 0.9 });
        return true;
      }
      if (kind === 'hit_bad'){
        P.burst({ x, y, count: Math.round(9*scale), spread: 0.70, speed: 0.95, life: 420, gravity: 1.0 });
        return true;
      }
      if (kind === 'shot_miss'){
        P.burst({ x, y, count: Math.round(6*scale), spread: 0.55, speed: 0.70, life: 340, gravity: 1.1 });
        return true;
      }
      // timeout_miss: “poof / fade” style
      if (kind === 'timeout_miss'){
        P.burst({ x, y, count: Math.round(8*scale), spread: 0.35, speed: 0.42, life: 520, gravity: 0.45 });
        return true;
      }
    }catch(_){}
    return false;
  }

  // -------------------- DOM fallback FX --------------------
  function mkRing(x, y, opts){
    ensureRoot();

    const el = DOC.createElement('div');
    el.className = 'fx-ring';

    const size = Number(opts.size||46);
    el.style.cssText =
      'position:absolute; left:0; top:0; width:'+size+'px; height:'+size+'px; '+
      'border-radius:999px; border:'+ (opts.border||'2px solid rgba(34,197,94,.85)') +'; '+
      'transform: translate('+(x-size/2)+'px,'+(y-size/2)+'px) scale(.70); '+
      'opacity: 0.95; filter: blur(0px);';

    S.root.appendChild(el);
    S.active++;

    // animate
    requestAnimationFrame(()=>{
      el.style.transition = 'transform 320ms ease, opacity 260ms ease, filter 320ms ease';
      el.style.transform = 'translate('+(x-size/2)+'px,'+(y-size/2)+'px) scale(1.50)';
      el.style.opacity = '0';
      el.style.filter = 'blur(0.6px)';
    });

    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
      S.active = Math.max(0, S.active-1);
    }, 360);
  }

  function mkPopText(x, y, text, opts){
    ensureRoot();

    const el = DOC.createElement('div');
    el.className = 'fx-pop';
    el.textContent = text || '';

    const fs = Number(opts.fontSize||18);
    el.style.cssText =
      'position:absolute; left:0; top:0; transform: translate('+x+'px,'+y+'px) translate(-50%,-50%) scale(.9); '+
      'font-weight: 1000; font-size:'+fs+'px; letter-spacing:.2px; '+
      'color:'+(opts.color||'#e5e7eb')+'; '+
      'text-shadow: 0 10px 20px rgba(0,0,0,.45); '+
      'opacity: 0.98;';

    S.root.appendChild(el);
    S.active++;

    requestAnimationFrame(()=>{
      el.style.transition = 'transform 360ms cubic-bezier(.2,.9,.2,1), opacity 280ms ease';
      el.style.transform = 'translate('+x+'px,'+y+'px) translate(-50%,-70%) scale(1.08)';
      el.style.opacity = '0';
    });

    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
      S.active = Math.max(0, S.active-1);
    }, 390);
  }

  function mkX(x, y){
    ensureRoot();

    const el = DOC.createElement('div');
    el.textContent = '✖';
    el.style.cssText =
      'position:absolute; left:0; top:0; transform: translate('+x+'px,'+y+'px) translate(-50%,-50%) scale(.9); '+
      'font-weight: 1000; font-size: 22px; color: rgba(239,68,68,.95); '+
      'text-shadow: 0 10px 20px rgba(0,0,0,.45); opacity:.96;';

    S.root.appendChild(el);
    S.active++;

    requestAnimationFrame(()=>{
      el.style.transition = 'transform 280ms ease, opacity 220ms ease';
      el.style.transform = 'translate('+x+'px,'+y+'px) translate(-50%,-65%) scale(1.05)';
      el.style.opacity = '0';
    });

    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
      S.active = Math.max(0, S.active-1);
    }, 300);
  }

  function domBurst(kind, x, y){
    if (S.active > S.maxActive) return;

    if (kind === 'hit_good'){
      mkRing(x,y,{ size:50, border:'2px solid rgba(34,197,94,.92)' });
      mkPopText(x, y-18, '+', { fontSize:18, color:'rgba(34,197,94,.98)' });
      return;
    }
    if (kind === 'hit_bad'){
      mkRing(x,y,{ size:46, border:'2px solid rgba(245,158,11,.90)' });
      mkX(x, y-2);
      return;
    }
    if (kind === 'shot_miss'){
      mkRing(x,y,{ size:44, border:'2px dashed rgba(148,163,184,.60)' });
      return;
    }
    if (kind === 'timeout_miss'){
      // timeout = “poof fade” (soft ring + text)
      mkRing(x,y,{ size:56, border:'2px solid rgba(148,163,184,.35)' });
      mkPopText(x, y-18, 'หมดเวลา', { fontSize:14, color:'rgba(148,163,184,.85)' });
      return;
    }
  }

  function burst(kind, x, y){
    kind = String(kind||'').toLowerCase();
    x = Number(x)||0;
    y = Number(y)||0;

    if (!canEmit(kind)) return false;

    // prefer particles (if present)
    if (particleBurst(kind, x, y)) return true;

    // fallback DOM fx
    domBurst(kind, x, y);
    return true;
  }

  function onHit(ev){
    try{
      const d = ev.detail||{};
      const kind = String(d.kind||'').toLowerCase();
      const x = Number(d.x)||0;
      const y = Number(d.y)||0;
      burst(kind, x, y);
    }catch(_){}
  }

  function init(opts){
    if (S.inited) return true;
    S.inited = true;

    ensureRoot();
    setLayerEl(opts && opts.layerEl);

    // allow disable fx for research if you want (default ON)
    const run = String(qs('run','play')||'play').toLowerCase();
    const fx  = String(qs('fx','1')||'1');
    if (run === 'research' && fx === '0') S.cfg.enabled = false;

    WIN.addEventListener('groups:hit', onHit, { passive:true });
    return true;
  }

  function destroy(){
    try{ WIN.removeEventListener('groups:hit', onHit, { passive:true }); }catch(_){}
    try{ if (S.root) S.root.remove(); }catch(_){}
    S.root = null;
    S.inited = false;
    S.active = 0;
  }

  WIN.GroupsVR.EffectsPack = { init, burst, destroy };
})();