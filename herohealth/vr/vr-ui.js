// === /herohealth/vr/vr-ui.js ===
// Universal VR UI — PRODUCTION
// ✅ ENTER VR / EXIT / RECENTER
// ✅ Crosshair overlay + tap-to-shoot => emits hha:shoot {x,y,lockPx,source}
// ✅ view=cvr strict: aim from center screen (targets can be pointer-events:none)
// ✅ No launcher, no view override (respects app/boot)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_VRUI_LOADED__) return;
  WIN.__HHA_VRUI_LOADED__ = true;

  const CFG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});
  const qs = (k,d=null)=>{ try{return new URL(location.href).searchParams.get(k) ?? d;}catch{return d;} };

  function getView(){
    const v = String(qs('view','')||'').toLowerCase();
    if(v) return v;
    const dv = String(DOC.body?.dataset?.view || '').toLowerCase();
    return dv || '';
  }
  function isCvrStrict(){ return getView() === 'cvr'; }

  function css(){
    const st = DOC.createElement('style');
    st.textContent = `
      .hha-vrui{
        position:fixed;
        right: calc(10px + env(safe-area-inset-right,0px));
        bottom: calc(10px + env(safe-area-inset-bottom,0px));
        z-index: 260;
        display:flex; gap:10px; flex-wrap:wrap;
        pointer-events:auto;
      }
      .hha-vrui .b{
        height:44px; padding:0 14px;
        border-radius: 16px;
        border:1px solid rgba(148,163,184,.20);
        background: rgba(2,6,23,.55);
        color:#e5e7eb;
        font-weight: 1100;
        cursor:pointer;
        backdrop-filter: blur(10px);
      }
      .hha-vrui .b.primary{
        border-color: rgba(34,197,94,.35);
        background: rgba(34,197,94,.16);
        color:#eafff3;
      }
      .hha-crosshair{
        position:fixed; left:50%; top:50%;
        width: 22px; height:22px;
        transform: translate(-50%,-50%);
        z-index: 140;
        pointer-events:none;
        opacity: .85;
      }
      .hha-crosshair:before,
      .hha-crosshair:after{
        content:"";
        position:absolute;
        left:50%; top:50%;
        transform: translate(-50%,-50%);
        border-radius:999px;
      }
      .hha-crosshair:before{
        width: 18px; height:18px;
        border: 2px solid rgba(226,232,240,.55);
        box-shadow: 0 12px 28px rgba(0,0,0,.45);
      }
      .hha-crosshair:after{
        width: 4px; height:4px;
        background: rgba(226,232,240,.75);
      }
      body.view-pc .hha-crosshair{ display:none; } /* PC click targets normally */
      body.view-mobile .hha-crosshair{ display:none; } /* mobile tap targets normally */
      body.view-vr .hha-crosshair{ display:block; }
      body.view-cvr .hha-crosshair{ display:block; }
    `;
    DOC.head.appendChild(st);
  }

  function mount(){
    css();

    const wrap = DOC.createElement('div');
    wrap.className = 'hha-vrui';
    wrap.innerHTML = `
      <button class="b primary" type="button" id="hhaEnterVr">ENTER VR</button>
      <button class="b" type="button" id="hhaExitVr">EXIT</button>
      <button class="b" type="button" id="hhaRecenter">RECENTER</button>
    `;
    DOC.body.appendChild(wrap);

    const cross = DOC.createElement('div');
    cross.className = 'hha-crosshair';
    DOC.body.appendChild(cross);

    const enterBtn = DOC.getElementById('hhaEnterVr');
    const exitBtn  = DOC.getElementById('hhaExitVr');
    const recBtn   = DOC.getElementById('hhaRecenter');

    // WebXR enter/exit
    async function enterVr(){
      const scene = DOC.querySelector('a-scene');
      const xr = scene && scene.renderer && scene.renderer.xr;
      if(!xr){
        // A-Frame path: ask scene to enter VR
        try{ scene && scene.enterVR && scene.enterVR(); }catch(_){}
        return;
      }
      try{
        const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures:['local-floor','bounded-floor','hand-tracking'] });
        xr.setSession(session);
      }catch(_){}
    }
    async function exitVr(){
      const scene = DOC.querySelector('a-scene');
      const xr = scene && scene.renderer && scene.renderer.xr;
      try{
        const s = xr && xr.getSession && xr.getSession();
        if(s) await s.end();
        else if(scene && scene.exitVR) scene.exitVR();
      }catch(_){}
    }
    function recenter(){
      try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', {detail:{ts:Date.now()}})); }catch(_){}
    }

    enterBtn && enterBtn.addEventListener('click', enterVr);
    exitBtn  && exitBtn.addEventListener('click', exitVr);
    recBtn   && recBtn.addEventListener('click', recenter);

    // tap-to-shoot (for vr/cvr)
    let last = 0;
    function emitShoot(source){
      const t = Date.now();
      if(t - last < CFG.cooldownMs) return;
      last = t;

      const x = Math.floor(DOC.documentElement.clientWidth/2);
      const y = Math.floor(DOC.documentElement.clientHeight/2);
      try{
        WIN.dispatchEvent(new CustomEvent('hha:shoot', {
          detail: { x, y, lockPx: CFG.lockPx, source }
        }));
      }catch(_){}
    }

    // In VR/cVR: click anywhere => shoot
    DOC.addEventListener('pointerdown', (e)=>{
      if(!(DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr'))) return;
      // do not shoot when clicking buttons
      const path = (e.composedPath && e.composedPath()) || [];
      if(path.some(n => n && n.id && (n.id==='hhaEnterVr'||n.id==='hhaExitVr'||n.id==='hhaRecenter'))) return;
      emitShoot(isCvrStrict() ? 'cvr' : 'vr');
    }, { passive:true });
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', mount);
  else mount();

})();