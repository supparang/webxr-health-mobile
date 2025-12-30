/* === /herohealth/vr/hha-vr-ui.js ===
HHA VR UI (Universal) — PC / Mobile / VR Cardboard (pseudo-VR)
✅ Body view classes: view-pc / view-mobile / view-vr / view-cvr
✅ Buttons: Enter VR (Cardboard), Fullscreen, Reset, Shoot
✅ Tap-to-shoot (anywhere) in cVR + Big SHOOT button
✅ Emits: hha:shoot {x,y,lockPx} and hha:vr {state:'reset'}
✅ Works for DOM games (Groups/Plate/Hydration/GoodJunk DOM layer)
How to use:
  - Include <script src="../vr/hha-vr-ui.js" defer></script>
  - Call window.HHAVRUI.init({ hub:'../index.html' }) once
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
  const qs = (k,def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; } };

  const UI = {
    inited:false,
    hub:null,
    lockPx: 92,
    lockPxCvr: 118,
    tapAnywhereCvr:true,
    allowTapEverywhere:false,
    _down:false
  };

  function isMobile(){
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function isFs(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }

  async function enterFs(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }catch(_){}
  }
  async function exitFs(){
    try{
      if (DOC.exitFullscreen) await DOC.exitFullscreen();
      else if (DOC.webkitExitFullscreen) await DOC.webkitExitFullscreen();
    }catch(_){}
  }

  async function lockLandscape(){
    try{
      const o = screen.orientation;
      if (o && o.lock) await o.lock('landscape');
    }catch(_){}
  }

  function setView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add(`view-${view}`);
    try{ localStorage.setItem('HHA_VIEW', view); }catch{}
  }

  function getSavedView(){
    const v = qs('view', null);
    if (v) return String(v).toLowerCase();
    try{
      return localStorage.getItem('HHA_VIEW') || '';
    }catch{ return ''; }
  }

  function emitShoot(x,y, lockPx){
    try{
      root.dispatchEvent(new CustomEvent('hha:shoot', { detail:{ x, y, lockPx } }));
    }catch{}
  }
  function emitVrReset(){
    try{
      root.dispatchEvent(new CustomEvent('hha:vr', { detail:{ state:'reset' } }));
    }catch{}
  }

  function ensureDom(){
    if (DOC.querySelector('.hha-vr-ui')) return;

    const wrap = DOC.createElement('div');
    wrap.className = 'hha-vr-ui';
    wrap.innerHTML = `
      <div class="hha-vr-controls" aria-label="VR Controls">
        <button class="hha-btn hha-btn-vr"   type="button" data-act="enter">🕶️ Enter VR</button>
        <button class="hha-btn hha-btn-fs"   type="button" data-act="fs">⛶ Fullscreen</button>
        <button class="hha-btn hha-btn-reset" type="button" data-act="reset">↺ Reset</button>
        <button class="hha-btn hha-btn-hub"  type="button" data-act="hub">⌂ HUB</button>
      </div>

      <div class="hha-crosshair" aria-hidden="true">
        <i></i><i></i>
      </div>

      <button class="hha-shoot" type="button" data-act="shoot" aria-label="Shoot">
        SHOOT
      </button>
    `;
    DOC.body.appendChild(wrap);

    wrap.addEventListener('click', async (e)=>{
      const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
      if (!btn) return;
      const act = btn.getAttribute('data-act');

      if (act === 'hub'){
        if (UI.hub) location.href = UI.hub;
        return;
      }
      if (act === 'reset'){
        emitVrReset();
        return;
      }
      if (act === 'fs'){
        if (isFs()) await exitFs();
        else await enterFs();
        return;
      }
      if (act === 'enter'){
        await enterCardboard();
        return;
      }
      if (act === 'shoot'){
        const x = (root.innerWidth||360)*0.5;
        const y = (root.innerHeight||640)*0.5;
        emitShoot(x,y, UI.lockPxCvr);
        return;
      }
    }, { passive:false });
  }

  async function enterCardboard(){
    await enterFs();
    await lockLandscape();
    setView('cvr');
    // helpful hint: keep screen awake if available
    try{
      if (navigator.wakeLock && navigator.wakeLock.request){
        await navigator.wakeLock.request('screen');
      }
    }catch(_){}
  }

  function autoBindTapShoot(){
    // Tap anywhere => shoot (mostly for testing / “จิ้มบนจอ”)
    // In real cardboard phone inside headset, user usually can’t tap,
    // but this supports cardboard-with-access or holding phone VR mode.
    DOC.addEventListener('pointerdown', (e)=>{
      UI._down = true;
      const b = DOC.body;
      const inCvr = b.classList.contains('view-cvr');

      if (!inCvr && !UI.allowTapEverywhere) return;

      // If user taps on a target (pc/mobile), let target handler work.
      // For cVR, targets typically pointer-events:none so this will fire on body.
      if (inCvr && UI.tapAnywhereCvr){
        const x = (root.innerWidth||360)*0.5;
        const y = (root.innerHeight||640)*0.5;
        emitShoot(x,y, UI.lockPxCvr);
        e.preventDefault?.();
        return;
      }

      // allow shot where user taps (optional)
      const x = Number(e.clientX);
      const y = Number(e.clientY);
      if (isFinite(x) && isFinite(y)){
        emitShoot(x,y, UI.lockPx);
      }
    }, { passive:false });

    DOC.addEventListener('pointerup', ()=>{ UI._down=false; }, { passive:true });

    // keyboard support
    DOC.addEventListener('keydown', (e)=>{
      const key = String(e.key||'').toLowerCase();
      if (key === ' ' || key === 'enter'){
        const x = (root.innerWidth||360)*0.5;
        const y = (root.innerHeight||640)*0.5;
        emitShoot(x,y, DOC.body.classList.contains('view-cvr') ? UI.lockPxCvr : UI.lockPx);
      }
      if (key === 'r') emitVrReset();
      if (key === 'f') (isFs()? exitFs(): enterFs());
    }, { passive:true });
  }

  function injectBaseCssOnce(){
    if (DOC.getElementById('hha-vr-ui-css')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vr-ui-css';
    st.textContent = `
      .hha-vr-ui{ position:fixed; inset:0; pointer-events:none; z-index:120; }
      .hha-vr-controls{
        position:fixed;
        left: calc(10px + env(safe-area-inset-left, 0px));
        bottom: calc(10px + env(safe-area-inset-bottom, 0px));
        display:flex; gap:8px; flex-wrap:wrap;
        pointer-events:auto;
      }
      .hha-btn{
        border:1px solid rgba(148,163,184,.22);
        background:rgba(2,6,23,.72);
        color:#e5e7eb;
        font: 900 12px/1 system-ui;
        padding:10px 12px;
        border-radius:999px;
        box-shadow:0 16px 40px rgba(0,0,0,.35);
      }
      .hha-btn:active{ transform: translateY(1px); }

      .hha-crosshair{
        position:fixed; left:50%; top:50%;
        transform:translate(-50%,-50%);
        width:22px; height:22px;
        opacity:.0;
        transition: opacity .15s ease;
      }
      .hha-crosshair i{
        position:absolute; left:50%; top:50%;
        width:18px; height:2px; background:rgba(226,232,240,.88);
        transform:translate(-50%,-50%);
        border-radius:2px;
        box-shadow:0 2px 10px rgba(0,0,0,.35);
      }
      .hha-crosshair i:nth-child(2){
        width:2px; height:18px;
      }

      .hha-shoot{
        position:fixed;
        left:50%;
        bottom: calc(18px + env(safe-area-inset-bottom, 0px));
        transform: translateX(-50%);
        pointer-events:auto;
        border:0;
        border-radius:999px;
        padding:16px 22px;
        font: 1000 14px/1 system-ui;
        letter-spacing:.06em;
        background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.90));
        color:#061018;
        box-shadow:0 22px 55px rgba(0,0,0,.55);
        opacity:0;
        transition: opacity .15s ease, transform .15s ease;
      }

      /* show crosshair + shoot only in cVR */
      body.view-cvr .hha-crosshair{ opacity: .92; }
      body.view-cvr .hha-shoot{ opacity: 1; }

      @media (max-width:520px){
        .hha-btn{ padding:9px 10px; font-size:11px; }
        .hha-shoot{ padding:15px 20px; font-size:13px; }
      }
    `;
    DOC.head.appendChild(st);
  }

  function init(opts){
    if (UI.inited) return;
    UI.inited = true;

    UI.hub = (opts && opts.hub) ? String(opts.hub) : (qs('hub','../index.html')||'../index.html');

    injectBaseCssOnce();
    ensureDom();
    autoBindTapShoot();

    const saved = getSavedView();
    if (saved === 'cvr' || saved === 'vr') setView(saved);
    else setView(isMobile() ? 'mobile' : 'pc');

    // if query says autovr=1 => enter cvr
    if (qs('autovr','0') === '1') enterCardboard();
  }

  root.HHAVRUI = { init, enterCardboard, setView };
})(typeof window !== 'undefined' ? window : globalThis);