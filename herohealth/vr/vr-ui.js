// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — SAFE UNIVERSAL — v20260217c (PATCH: now() defined)
// Purpose:
//  - Provide ENTER VR / EXIT / RECENTER UI for HeroHealth games
//  - Provide crosshair + tap-to-shoot -> emits window event: hha:shoot {x,y,lockPx,cooldownMs,source}
//  - Support view=cvr strict: shoot from center crosshair (optional)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if(WIN.__HHA_VRUI_READY__) return;
  WIN.__HHA_VRUI_READY__ = true;

  function now(){
    try{ return (performance && typeof performance.now === 'function') ? performance.now() : Date.now(); }
    catch(_){ return Date.now(); }
  }

  function qs(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  }

  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return v<a?a:(v>b?b:v);
  }

  // ---- config ----
  const CFG0 = WIN.HHA_VRUI_CONFIG || {};
  const VIEW = String(qs('view','') || DOC.documentElement?.dataset?.view || '').toLowerCase();
  const IS_CVR = (VIEW === 'cvr' || VIEW === 'cardboard' || DOC.documentElement?.dataset?.view === 'cvr');

  const CFG = {
    lockPx: clamp(CFG0.lockPx ?? 28, 6, 80),
    cooldownMs: clamp(CFG0.cooldownMs ?? 90, 20, 400),
    showCrosshair: (CFG0.showCrosshair !== false),
    showButtons: (CFG0.showButtons !== false),
    cvrStrict: (CFG0.cvrStrict !== false), // default true
  };

  // ---- DOM layer + style ----
  let ui = null;
  let crosshair = null;
  let lastShotAt = 0;

  function ensureStyle(){
    if(DOC.getElementById('hha-vrui-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vrui-style';
    st.textContent = `
      #hha-vrui{
        position:fixed;
        left: max(10px, env(safe-area-inset-left, 0px));
        right: max(10px, env(safe-area-inset-right, 0px));
        bottom: max(10px, env(safe-area-inset-bottom, 0px));
        z-index: 9997;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
        pointer-events:none;
      }
      #hha-vrui .hha-btn{
        pointer-events:auto;
        appearance:none;
        border:none;
        border-radius:999px;
        padding:10px 12px;
        background: rgba(2,6,23,.70);
        border: 1px solid rgba(148,163,184,.22);
        color: rgba(229,231,235,.96);
        font: 1000 12px/1 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        box-shadow: 0 16px 40px rgba(0,0,0,.32);
        backdrop-filter: blur(10px);
        cursor:pointer;
        user-select:none;
        -webkit-tap-highlight-color: transparent;
      }
      #hha-vrui .hha-btn:active{ transform: translateY(1px); }

      #hha-crosshair{
        position:fixed;
        left:50%;
        top:50%;
        width:20px;
        height:20px;
        transform: translate(-50%,-50%);
        z-index: 9996;
        pointer-events:none;
        opacity: .92;
        display:grid;
        place-items:center;
      }
      #hha-crosshair:before{
        content:'';
        width:18px; height:18px;
        border-radius:999px;
        border: 2px solid rgba(229,231,235,.62);
        box-shadow: 0 0 0 2px rgba(2,6,23,.55);
      }
      #hha-crosshair:after{
        content:'';
        position:absolute;
        width:2px; height:2px;
        border-radius:999px;
        background: rgba(229,231,235,.95);
        box-shadow: 0 0 0 2px rgba(2,6,23,.55);
      }

      #hha-vrui-hint{
        position:fixed;
        left: max(10px, env(safe-area-inset-left, 0px));
        top: max(10px, env(safe-area-inset-top, 0px));
        z-index: 9997;
        pointer-events:none;
        background: rgba(2,6,23,.55);
        border: 1px solid rgba(148,163,184,.18);
        color: rgba(229,231,235,.92);
        border-radius: 999px;
        padding: 6px 10px;
        font: 1000 12px/1 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
        backdrop-filter: blur(10px);
        display:none;
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureUI(){
    ensureStyle();

    if(CFG.showButtons && !ui){
      ui = DOC.getElementById('hha-vrui');
      if(!ui){
        ui = DOC.createElement('div');
        ui.id = 'hha-vrui';
        DOC.body.appendChild(ui);
      }

      if(!ui.__built){
        ui.__built = true;
        ui.innerHTML = '';

        const mk = (id, text)=>{
          const b = DOC.createElement('button');
          b.className = 'hha-btn';
          b.id = id;
          b.type = 'button';
          b.textContent = text;
          return b;
        };

        const btnEnter = mk('hhaBtnEnterVR', '🕶 ENTER VR');
        const btnExit  = mk('hhaBtnExitVR',  '🚪 EXIT VR');
        const btnRe    = mk('hhaBtnRecenter','🎯 RECENTER');

        ui.appendChild(btnEnter);
        ui.appendChild(btnExit);
        ui.appendChild(btnRe);

        btnEnter.addEventListener('click', ()=> enterVR(), {passive:true});
        btnExit.addEventListener('click',  ()=> exitVR(),  {passive:true});
        btnRe.addEventListener('click',    ()=> recenter(),{passive:true});

        btnExit.style.display = 'none';
      }
    }

    if(CFG.showCrosshair && !crosshair){
      crosshair = DOC.getElementById('hha-crosshair');
      if(!crosshair){
        crosshair = DOC.createElement('div');
        crosshair.id = 'hha-crosshair';
        DOC.body.appendChild(crosshair);
      }
      crosshair.style.display = 'grid';
      crosshair.style.opacity = IS_CVR ? '0.98' : '0.88';
    }

    let hint = DOC.getElementById('hha-vrui-hint');
    if(!hint){
      hint = DOC.createElement('div');
      hint.id = 'hha-vrui-hint';
      hint.textContent = 'Cardboard: แตะจอเพื่อยิงจาก crosshair';
      DOC.body.appendChild(hint);
    }
    if(IS_CVR){
      hint.style.display = 'inline-flex';
      setTimeout(()=>{ try{ hint.style.display='none'; }catch(_){} }, 3500);
    }
  }

  function getScene(){
    try{ return DOC.querySelector('a-scene'); }catch(_){ return null; }
  }

  function enterVR(){
    const s = getScene();
    try{ if(s && typeof s.enterVR === 'function') s.enterVR(); }catch(_){}
  }

  function exitVR(){
    const s = getScene();
    try{ if(s && typeof s.exitVR === 'function') s.exitVR(); }catch(_){}
  }

  function recenter(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'vr-ui' } })); }catch(_){}
    try{
      const cam = DOC.querySelector('a-camera');
      const lc = cam && cam.components && cam.components['look-controls'];
      if(lc && typeof lc.reset === 'function') lc.reset();
    }catch(_){}
  }

  function setVrButtons(inVr){
    if(!ui) return;
    const enter = DOC.getElementById('hhaBtnEnterVR');
    const exit  = DOC.getElementById('hhaBtnExitVR');
    if(enter) enter.style.display = inVr ? 'none' : 'inline-flex';
    if(exit)  exit.style.display  = inVr ? 'inline-flex' : 'none';
  }

  function wireVrState(){
    const s = getScene();
    if(!s || s.__hhaVrStateWired) return;
    s.__hhaVrStateWired = true;
    s.addEventListener('enter-vr', ()=> setVrButtons(true),  {passive:true});
    s.addEventListener('exit-vr',  ()=> setVrButtons(false), {passive:true});
  }

  function emitShoot(x,y, source){
    const t = now();
    if(t - lastShotAt < CFG.cooldownMs) return;
    lastShotAt = t;

    try{
      WIN.dispatchEvent(new CustomEvent('hha:shoot', {
        detail:{
          x: Number(x),
          y: Number(y),
          lockPx: CFG.lockPx,
          cooldownMs: CFG.cooldownMs,
          source: source || 'tap',
          view: IS_CVR ? 'cvr' : 'screen'
        }
      }));
    }catch(_){}
  }

  function centerShoot(source){
    emitShoot(innerWidth/2, innerHeight/2, source || 'tap');
  }

  function wireTapShoot(){
    if(WIN.__HHA_VRUI_TAP_WIRED__) return;
    WIN.__HHA_VRUI_TAP_WIRED__ = true;

    DOC.addEventListener('pointerdown', (ev)=>{
      if(ev.defaultPrevented) return;

      if(IS_CVR && CFG.cvrStrict){
        centerShoot('tap');
      }else{
        emitShoot(ev.clientX, ev.clientY, 'pointer');
      }
    }, {passive:true});

    DOC.addEventListener('keydown', (ev)=>{
      if(ev.code === 'Space') centerShoot('space');
    }, {passive:true});
  }

  function applyCvrStrict(){
    if(!(IS_CVR && CFG.cvrStrict)) return;
    try{ DOC.documentElement.dataset.view = 'cvr'; }catch(_){}
  }

  function init(){
    ensureUI();
    wireVrState();
    wireTapShoot();
    applyCvrStrict();
    setTimeout(()=>{ try{ ensureUI(); wireVrState(); }catch(_){ } }, 600);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, {once:true});
  }else{
    init();
  }

})();