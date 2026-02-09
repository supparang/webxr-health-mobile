// === /herohealth/vr-groups/effects-pack.js ===
// GroupsVR Effects Pack — PRODUCTION (PATCH v20260208d)
// ✅ Listens: 'groups:hit' {kind,x,y,good,miss}
// ✅ Visual FX: burst + ring + floating text + screen shake (soft)
// ✅ Safe: never throws; auto cleans DOM; respects reduced motion
// ✅ Integrates optional particles.js (window.HHA_Particles / window.Particles)

(function(){
  'use strict';

  const WIN = window;
  WIN.GroupsVR = WIN.GroupsVR || {};

  const DOC = document;
  const RM = (()=> {
    try { return WIN.matchMedia && WIN.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch { return false; }
  })();

  const S = {
    inited:false,
    layerEl:null,
    fxRoot:null,
    lastShakeAt:0
  };

  function now(){
    try { return performance.now(); } catch { return Date.now(); }
  }

  function clamp(v,a,b){
    v = Number(v)||0;
    return v<a?a:(v>b?b:v);
  }

  function ensureRoot(){
    if (S.fxRoot && DOC.body.contains(S.fxRoot)) return;

    const root = DOC.createElement('div');
    root.id = 'groupsFxRoot';
    root.style.cssText =
      'position:absolute; inset:0; pointer-events:none; '+
      'z-index:70; overflow:hidden; contain:layout style paint;';
    S.fxRoot = root;

    const host = S.layerEl || DOC.body;
    // ensure host positioned
    try{
      const cs = WIN.getComputedStyle(host);
      if (cs.position === 'static') host.style.position = 'relative';
    }catch(_){}

    host.appendChild(root);
  }

  function setLayerEl(el){
    S.layerEl = el || DOC.body;
    ensureRoot();
  }

  function cleanupNode(el, ms){
    setTimeout(()=>{ try{ el && el.remove && el.remove(); }catch(_){ } }, ms|0);
  }

  function burst(x,y, kind){
    ensureRoot();

    // 1) optional Particles helper
    try{
      const P = WIN.HHA_Particles || WIN.Particles;
      if (P && typeof P.burst === 'function'){
        P.burst({ x, y, kind: String(kind||'') });
      }
    }catch(_){}

    // 2) lightweight DOM sparks (always available)
    const n = (kind === 'hit_good') ? 14 : (kind === 'hit_bad' ? 12 : 10);
    const root = S.fxRoot;

    for (let i=0;i<n;i++){
      const p = DOC.createElement('div');
      const a = (Math.random()*Math.PI*2);
      const r = (kind === 'hit_good') ? (34 + Math.random()*26) : (28 + Math.random()*22);

      const dx = Math.cos(a)*r;
      const dy = Math.sin(a)*r;

      p.style.cssText =
        'position:absolute; left:0; top:0; width:8px; height:8px; '+
        'border-radius:99px; opacity:.95; transform:translate(-50%,-50%); '+
        'will-change: transform, opacity;';

      // use currentColor by class via CSS? keep inline neutral (no custom colors requested)
      // differentiate via brightness only
      p.style.background = (kind === 'hit_good') ? 'rgba(255,255,255,.92)'
                       : (kind === 'hit_bad')  ? 'rgba(255,255,255,.75)'
                       : 'rgba(255,255,255,.55)';

      p.style.left = Math.round(x) + 'px';
      p.style.top  = Math.round(y) + 'px';
      root.appendChild(p);

      const dur = RM ? 1 : (180 + Math.random()*120);

      requestAnimationFrame(()=>{
        p.style.transition = `transform ${dur}ms ease-out, opacity ${dur}ms ease-out`;
        p.style.transform =
          `translate(${dx}px, ${dy}px) scale(${0.9 + Math.random()*0.7})`;
        p.style.opacity = '0';
      });

      cleanupNode(p, dur + 40);
    }
  }

  function ring(x,y, kind){
    ensureRoot();
    if (RM) return;

    const el = DOC.createElement('div');
    el.style.cssText =
      'position:absolute; left:0; top:0; width:10px; height:10px; '+
      'border-radius:999px; border:2px solid rgba(255,255,255,.8); '+
      'transform:translate(-50%,-50%) scale(.6); opacity:.9; '+
      'pointer-events:none; will-change: transform, opacity;';
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';

    const root = S.fxRoot;
    root.appendChild(el);

    const dur = (kind === 'hit_good') ? 260 : (kind === 'hit_bad' ? 240 : 220);

    requestAnimationFrame(()=>{
      el.style.transition = `transform ${dur}ms ease-out, opacity ${dur}ms ease-out`;
      el.style.transform = 'translate(-50%,-50%) scale(4.0)';
      el.style.opacity = '0';
    });

    cleanupNode(el, dur + 40);
  }

  function floatText(x,y, text){
    ensureRoot();
    const el = DOC.createElement('div');
    el.textContent = String(text||'');
    el.style.cssText =
      'position:absolute; left:0; top:0; transform:translate(-50%,-50%); '+
      'font-weight:900; font-size:16px; letter-spacing:.2px; '+
      'text-shadow:0 10px 26px rgba(0,0,0,.45); '+
      'opacity:.95; will-change: transform, opacity;';
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';

    const root = S.fxRoot;
    root.appendChild(el);

    const dur = RM ? 1 : 520;
    requestAnimationFrame(()=>{
      el.style.transition = `transform ${dur}ms ease-out, opacity ${dur}ms ease-out`;
      el.style.transform = 'translate(-50%,-85%) scale(1.02)';
      el.style.opacity = '0';
    });
    cleanupNode(el, dur + 60);
  }

  function shake(kind){
    if (RM) return;
    const t = now();
    if (t - S.lastShakeAt < 110) return; // throttle
    S.lastShakeAt = t;

    const body = DOC.body;
    if (!body) return;

    const cls =
      (kind === 'hit_good') ? 'fx-shake-good' :
      (kind === 'hit_bad')  ? 'fx-shake-bad' :
      'fx-shake-miss';

    body.classList.add(cls);
    setTimeout(()=>{ try{ body.classList.remove(cls); }catch(_){ } }, 160);
  }

  function onHit(ev){
    const d = ev && ev.detail ? ev.detail : null;
    if (!d) return;

    const kind = String(d.kind || '');
    const x = clamp(d.x, 0, WIN.innerWidth || 9999);
    const y = clamp(d.y, 0, WIN.innerHeight|| 9999);

    // kind: hit_good | hit_bad | shot_miss | timeout_miss
    if (!kind) return;

    burst(x,y, kind);
    ring(x,y, kind);

    if (kind === 'hit_good'){
      floatText(x, y, '✅ +');
      shake('hit_good');
    } else if (kind === 'hit_bad'){
      floatText(x, y, '⚠️');
      shake('hit_bad');
    } else if (kind === 'timeout_miss'){
      floatText(x, y, '⌛');
      shake('timeout_miss');
    } else if (kind === 'shot_miss'){
      floatText(x, y, '❌');
      shake('shot_miss');
    }
  }

  function injectCssOnce(){
    if (DOC.getElementById('groupsFxCss')) return;
    const st = DOC.createElement('style');
    st.id = 'groupsFxCss';
    st.textContent = `
      @keyframes gShakeGood { 0%{transform:translate3d(0,0,0)} 25%{transform:translate3d(1px,-1px,0)} 50%{transform:translate3d(-1px,1px,0)} 100%{transform:translate3d(0,0,0)} }
      @keyframes gShakeBad  { 0%{transform:translate3d(0,0,0)} 20%{transform:translate3d(2px,0,0)} 40%{transform:translate3d(-2px,1px,0)} 100%{transform:translate3d(0,0,0)} }
      @keyframes gShakeMiss { 0%{transform:translate3d(0,0,0)} 20%{transform:translate3d(0,2px,0)} 40%{transform:translate3d(0,-2px,0)} 100%{transform:translate3d(0,0,0)} }

      body.fx-shake-good { animation: gShakeGood 140ms ease-out; }
      body.fx-shake-bad  { animation: gShakeBad  150ms ease-out; }
      body.fx-shake-miss { animation: gShakeMiss 150ms ease-out; }
    `;
    DOC.head.appendChild(st);
  }

  function init(opts){
    if (S.inited) return;
    S.inited = true;
    setLayerEl(opts && opts.layerEl ? opts.layerEl : (DOC.getElementById('playLayer') || DOC.body));
    injectCssOnce();

    WIN.addEventListener('groups:hit', onHit, { passive:true });
  }

  function destroy(){
    try{ WIN.removeEventListener('groups:hit', onHit, { passive:true }); }catch(_){}
    try{ if (S.fxRoot) S.fxRoot.remove(); }catch(_){}
    S.fxRoot = null;
    S.inited = false;
  }

  WIN.GroupsVR.EffectsPack = { init, destroy, setLayerEl };

})();