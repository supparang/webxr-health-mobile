/* === /herohealth/vr/vr-ui.js ===
HeroHealth VR UI (DOM games) — Universal Module
✅ Enter Cardboard VR (pseudo VR): fullscreen + cVR class + crosshair
✅ Tap-to-shoot (dispatch hha:shoot) — in cVR shoot from center
✅ PC/Mobile: optional tap-to-shoot (at tap position)
✅ Recenter (dispatch hha:vr {state:'reset'})
✅ LockPx aim assist configurable
Expose: window.HHAVRUI = { init, enterVR, exitVR, recenter, setLockPx, isVR }
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function qs(k, def=null){
    try{ return new URL(root.location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function isFullscreen(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }
  async function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }catch(_){}
  }
  async function exitFullscreen(){
    try{
      if (DOC.exitFullscreen) await DOC.exitFullscreen();
      else if (DOC.webkitExitFullscreen) await DOC.webkitExitFullscreen();
    }catch(_){}
  }

  function emit(name, detail){
    try{ root.dispatchEvent(new CustomEvent(name,{ detail: detail||{} })); }catch{}
  }

  function ensureStylesOnce(){
    if (ensureStylesOnce._done) return;
    ensureStylesOnce._done = true;

    const st = DOC.createElement('style');
    st.textContent = `
      .hha-vrbtns{
        position:fixed; left:12px; bottom:calc(12px + env(safe-area-inset-bottom,0px));
        z-index:999; display:flex; gap:8px; align-items:center;
        font-family:system-ui,-apple-system,Segoe UI,sans-serif;
        pointer-events:auto;
      }
      .hha-vrbtns.right{ left:auto; right:12px; }
      .hha-vrbtn{
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.72);
        color:#e5e7eb;
        border-radius:999px;
        padding:10px 12px;
        font-weight:900;
        font-size:12px;
        box-shadow:0 16px 40px rgba(0,0,0,.35);
        cursor:pointer;
        user-select:none;
        -webkit-tap-highlight-color: transparent;
      }
      .hha-vrbtn.primary{
        border:0;
        background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.90));
        color:#061018;
      }
      .hha-crosshair{
        position:fixed; left:50%; top:50%;
        width:26px; height:26px;
        transform:translate(-50%,-50%);
        z-index:998;
        pointer-events:none;
        opacity:.92;
        display:none;
      }
      body.view-cvr .hha-crosshair{ display:block; }

      .hha-crosshair::before,
      .hha-crosshair::after{
        content:"";
        position:absolute; left:50%; top:50%;
        width:26px; height:26px;
        transform:translate(-50%,-50%);
        border-radius:999px;
        border:2px solid rgba(226,232,240,.75);
        box-shadow:0 0 0 6px rgba(34,211,238,.12);
      }
      .hha-crosshair::after{
        width:6px; height:6px;
        border:0;
        background:rgba(34,197,94,.92);
        box-shadow:0 0 0 8px rgba(34,197,94,.10);
      }

      /* in cVR: prevent direct tapping targets, use shoot dispatch */
      body.view-cvr .fg-target{ pointer-events:none !important; }
    `;
    DOC.head.appendChild(st);
  }

  const S = {
    inited:false,
    isVR:false,
    lockPx: 86,
    tapAtCursorInVR:true,
    tapShootOutsideVR:false,
    buttonsSide:'left',
    allowFullscreen:true,
    rootEl:null,
    crosshairEl:null,
    btnWrap:null,
    _bound:false
  };

  function ensureUI(){
    ensureStylesOnce();

    if (!S.crosshairEl){
      const ch = DOC.createElement('div');
      ch.className = 'hha-crosshair';
      DOC.body.appendChild(ch);
      S.crosshairEl = ch;
    }

    if (!S.btnWrap){
      const wrap = DOC.createElement('div');
      wrap.className = 'hha-vrbtns' + (S.buttonsSide==='right' ? ' right' : '');
      wrap.innerHTML = `
        <button class="hha-vrbtn primary" data-act="enter">🕶️ ENTER VR</button>
        <button class="hha-vrbtn" data-act="recenter">🎯 RECENTER</button>
        <button class="hha-vrbtn" data-act="exit" style="display:none;">✖ EXIT</button>
      `;
      DOC.body.appendChild(wrap);
      S.btnWrap = wrap;

      wrap.addEventListener('click', async (e)=>{
        const b = e.target && e.target.closest ? e.target.closest('button[data-act]') : null;
        if (!b) return;
        const act = b.dataset.act;

        if (act === 'enter') await enterVR();
        if (act === 'exit') await exitVR();
        if (act === 'recenter') recenter();
      });
    }
  }

  function setButtonsState(){
    if (!S.btnWrap) return;
    const enter = S.btnWrap.querySelector('button[data-act="enter"]');
    const exit  = S.btnWrap.querySelector('button[data-act="exit"]');
    if (enter) enter.style.display = S.isVR ? 'none' : 'inline-flex';
    if (exit)  exit.style.display  = S.isVR ? 'inline-flex' : 'none';
  }

  function setBodyVR(on){
    DOC.body.classList.toggle('view-cvr', !!on);
    S.isVR = !!on;
    setButtonsState();
  }

  function recenter(){
    emit('hha:vr', { state:'reset' });
  }

  function shootAt(x,y){
    emit('hha:shoot', {
      x: Number(x),
      y: Number(y),
      lockPx: S.lockPx
    });
  }

  function centerXY(){
    return { x: (root.innerWidth||360)*0.5, y: (root.innerHeight||640)*0.5 };
  }

  function bindOnce(){
    if (S._bound) return;
    S._bound = true;

    // Tap anywhere:
    // - in cVR => shoot from center (crosshair)
    // - else if tapShootOutsideVR => shoot at tap position
    DOC.addEventListener('pointerdown', (e)=>{
      if (!S.inited) return;
      if (S.isVR){
        if (S.tapAtCursorInVR){
          const c = centerXY();
          shootAt(c.x, c.y);
          return;
        }
      }else{
        if (S.tapShootOutsideVR){
          shootAt(e.clientX, e.clientY);
        }
      }
    }, { passive:true });

    // Keyboard shoot (space / enter) — aim at center
    DOC.addEventListener('keydown', (e)=>{
      if (!S.inited) return;
      const k = String(e.key||'').toLowerCase();
      if (k === ' ' || k === 'spacebar' || k === 'enter'){
        const c = centerXY();
        shootAt(c.x, c.y);
      }
      if (k === 'r') recenter();
      if (k === 'v') (S.isVR ? exitVR() : enterVR());
    });

    // Keep in sync if fullscreen is exited by system
    DOC.addEventListener('fullscreenchange', ()=>{
      if (!isFullscreen() && S.isVR){
        // user/system exited fullscreen -> still keep VR mode or exit?
        // we keep VR mode but allow user to exit manually.
      }
    });
  }

  async function enterVR(){
    ensureUI();
    if (S.allowFullscreen) await requestFullscreen();
    setBodyVR(true);
    recenter();
  }

  async function exitVR(){
    setBodyVR(false);
    if (S.allowFullscreen && isFullscreen()) await exitFullscreen();
    recenter();
  }

  function setLockPx(px){
    S.lockPx = clamp(px, 40, 160);
  }

  function init(opts){
    opts = opts || {};
    S.inited = true;

    S.lockPx = clamp(opts.lockPx ?? Number(qs('lockPx')||86), 40, 160);
    S.tapAtCursorInVR = (opts.tapAtCursorInVR ?? true) !== false;
    S.tapShootOutsideVR = !!opts.tapShootOutsideVR;
    S.allowFullscreen = (opts.allowFullscreen ?? true) !== false;
    S.buttonsSide = (opts.buttonsSide === 'right') ? 'right' : 'left';

    ensureUI();
    bindOnce();

    // auto VR if ?cvr=1 or ?view=cvr
    const auto = (String(qs('cvr')||'') === '1') || (String(qs('view')||'') === 'cvr');
    if (auto){
      // don’t force fullscreen automatically; user can press Enter VR
      setBodyVR(true);
      recenter();
    }else{
      setBodyVR(false);
    }

    setButtonsState();
    return { enterVR, exitVR, recenter, setLockPx };
  }

  root.HHAVRUI = {
    init,
    enterVR,
    exitVR,
    recenter,
    setLockPx,
    isVR: ()=>!!S.isVR
  };
})(typeof window!=='undefined'?window:globalThis);