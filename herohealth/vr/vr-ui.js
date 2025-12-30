/* === /herohealth/vr/vr-ui.js ===
Universal VR UI — ENTER VR / EXIT / RECENTER + Crosshair + Tap-to-Shoot
- Works for DOM games (non A-Frame) using Cardboard mode = view-cvr
- Always shows buttons (even if WebXR not available)
- Emits:
   - hha:shoot {x,y,lockPx,source}
   - hha:vr {state:'enter'|'exit'|'reset'}
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const api = (root.HHAVRUI = root.HHAVRUI || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  let mounted = false;
  let cfg = { lockPx: 96 };

  function $(sel){ return DOC.querySelector(sel); }

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

  function ensureStyles(){
    if ($('#hha-vr-ui-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vr-ui-style';
    st.textContent = `
      .hha-vr-ui{
        position:fixed; left:12px; top:calc(12px + env(safe-area-inset-top,0px));
        z-index:9999; display:flex; gap:10px; align-items:center;
        pointer-events:auto; user-select:none;
      }
      .hha-vr-ui .btn{
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.72);
        color:#e5e7eb;
        padding:10px 12px;
        border-radius:999px;
        font:900 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;
        box-shadow:0 16px 40px rgba(0,0,0,.35);
        cursor:pointer;
      }
      .hha-vr-ui .btn.primary{
        background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.90));
        color:#061018;
        border:0;
      }
      .hha-crosshair{
        position:fixed; left:50%; top:50%;
        width:16px; height:16px;
        transform:translate(-50%,-50%);
        z-index:9998;
        pointer-events:none;
        opacity:.95;
      }
      .hha-crosshair:before,.hha-crosshair:after{
        content:"";
        position:absolute; left:50%; top:50%;
        background:rgba(226,232,240,.92);
        transform:translate(-50%,-50%);
        border-radius:2px;
      }
      .hha-crosshair:before{ width:14px; height:2px; }
      .hha-crosshair:after{ width:2px; height:14px; }
      body.view-cvr .hha-crosshair{ opacity:1; filter:drop-shadow(0 8px 18px rgba(0,0,0,.55)); }
      body:not(.view-cvr) .hha-crosshair{ opacity:.45; }
    `;
    DOC.head.appendChild(st);
  }

  function ensureUI(){
    ensureStyles();

    if (!$('#hha-vr-ui')){
      const ui = DOC.createElement('div');
      ui.className = 'hha-vr-ui';
      ui.id = 'hha-vr-ui';
      ui.innerHTML = `
        <button class="btn primary" id="hhaEnterVr">ENTER VR</button>
        <button class="btn" id="hhaExitVr">EXIT</button>
        <button class="btn" id="hhaRecenter">RECENTER</button>
      `;
      DOC.body.appendChild(ui);
    }
    if (!$('#hha-crosshair')){
      const ch = DOC.createElement('div');
      ch.className = 'hha-crosshair';
      ch.id = 'hha-crosshair';
      DOC.body.appendChild(ch);
    }
  }

  function setViewCvr(on){
    DOC.body.classList.toggle('view-cvr', !!on);
    DOC.body.classList.toggle('view-vr', !!on); // เผื่อ CSS เดิมใช้ view-vr
  }

  function shootFromCenter(source='tap'){
    const x = (root.innerWidth || 0) * 0.5;
    const y = (root.innerHeight || 0) * 0.5;
    emit('hha:shoot', { x, y, lockPx: cfg.lockPx, source });
  }

  function bind(){
    const enterBtn = $('#hhaEnterVr');
    const exitBtn  = $('#hhaExitVr');
    const recBtn   = $('#hhaRecenter');

    if (enterBtn && !enterBtn._bound){
      enterBtn._bound = true;
      enterBtn.addEventListener('click', async ()=>{
        // DOM-Cardboard mode: set view-cvr + fullscreen (optional)
        setViewCvr(true);
        if (!isFs()) await enterFs();
        emit('hha:vr', { state:'enter' });
      });
    }

    if (exitBtn && !exitBtn._bound){
      exitBtn._bound = true;
      exitBtn.addEventListener('click', async ()=>{
        setViewCvr(false);
        if (isFs()) await exitFs();
        emit('hha:vr', { state:'exit' });
      });
    }

    if (recBtn && !recBtn._bound){
      recBtn._bound = true;
      recBtn.addEventListener('click', ()=>{
        emit('hha:vr', { state:'reset' });
      });
    }

    // Tap anywhere in view-cvr => shoot
    if (!DOC.body._hhaShootBound){
      DOC.body._hhaShootBound = true;
      DOC.addEventListener('pointerdown', (ev)=>{
        if (!DOC.body.classList.contains('view-cvr')) return;
        // avoid clicking UI buttons
        const t = ev.target;
        if (t && (t.id==='hhaEnterVr' || t.id==='hhaExitVr' || t.id==='hhaRecenter' || t.closest?.('#hha-vr-ui'))) return;
        shootFromCenter('tap');
      }, { passive:true });
    }
  }

  api.init = function(options={}){
    cfg.lockPx = Math.max(40, Math.min(160, Number(options.lockPx || cfg.lockPx)));
    if (mounted) return;
    mounted = true;

    const go = ()=>{
      ensureUI();
      bind();
    };

    if (DOC.readyState === 'loading'){
      DOC.addEventListener('DOMContentLoaded', go, { once:true });
    }else{
      go();
    }
  };

  // auto-init (safe)
  try{ api.init({ lockPx: 96 }); }catch{}

})(typeof window!=='undefined'?window:globalThis);