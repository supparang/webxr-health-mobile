/* === /herohealth/vr/vr-ui.js ===
HHA Universal VR UI (DOM/VR Cardboard Friendly)
✅ Fullscreen button + "Enter VR" (Cardboard mode)
✅ Crosshair overlay
✅ Tap anywhere => emit hha:shoot (aim assist handled by engine)
✅ Reset view button => emit hha:vr {state:'reset'}
✅ Auto unlock audio on gesture (calls GroupsVR.Audio.unlock / HHA audio if exists)
Usage:
  <script src="../vr/vr-ui.js" defer></script>
  window.HHAVRUI.mount({ lockPx: 92 });
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const API = (root.HHAVRUI = root.HHAVRUI || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }

  function isFS(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }
  async function enterFS(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }catch{}
  }
  async function exitFS(){
    try{
      if (DOC.exitFullscreen) await DOC.exitFullscreen();
      else if (DOC.webkitExitFullscreen) await DOC.webkitExitFullscreen();
    }catch{}
  }

  function unlockAudio(){
    try{ root.GroupsVR?.Audio?.unlock?.(); }catch{}
    try{ root.HHAudio?.unlock?.(); }catch{}
  }

  function ensureStyles(){
    if (DOC.getElementById('hha-vr-ui-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vr-ui-style';
    st.textContent = `
      .hha-vr-ui{ position:fixed; inset:0; pointer-events:none; z-index:140; }
      .hha-vr-bar{
        position:fixed; left:12px; right:12px; bottom:calc(12px + env(safe-area-inset-bottom,0px));
        display:flex; gap:10px; flex-wrap:wrap; justify-content:center;
        pointer-events:none; z-index:141;
      }
      .hha-vr-btn{
        pointer-events:auto;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.72);
        color:#e5e7eb;
        border-radius:999px;
        padding:10px 14px;
        font: 900 13px/1 system-ui;
        box-shadow:0 18px 50px rgba(0,0,0,.35);
        cursor:pointer;
        user-select:none;
      }
      .hha-vr-btn.primary{
        background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.90));
        color:#061018; border:0;
      }
      .hha-crosshair{
        position:fixed; left:50%; top:50%;
        width:26px; height:26px;
        transform:translate(-50%,-50%);
        border-radius:999px;
        border:2px solid rgba(226,232,240,.85);
        box-shadow:0 0 0 6px rgba(34,211,238,.10);
        pointer-events:none; z-index:142;
      }
      .hha-crosshair::after{
        content:""; position:absolute; left:50%; top:50%;
        width:6px; height:6px; transform:translate(-50%,-50%);
        border-radius:999px; background:rgba(226,232,240,.85);
      }
      body.view-cvr .hha-crosshair{ box-shadow:0 0 0 10px rgba(34,197,94,.10); }
    `;
    DOC.head.appendChild(st);
  }

  function mount(opts){
    opts = opts || {};
    const lockPx = Math.max(40, Math.min(160, Number(opts.lockPx||92)));
    const tapMode = (qs('view','') || '').toLowerCase(); // optional
    const allowReset = opts.allowReset !== false;

    ensureStyles();

    let wrap = DOC.querySelector('.hha-vr-ui');
    if (!wrap){
      wrap = DOC.createElement('div');
      wrap.className = 'hha-vr-ui';
      DOC.body.appendChild(wrap);
    }

    let cross = DOC.querySelector('.hha-crosshair');
    if (!cross){
      cross = DOC.createElement('div');
      cross.className = 'hha-crosshair';
      wrap.appendChild(cross);
    }

    let bar = DOC.querySelector('.hha-vr-bar');
    if (!bar){
      bar = DOC.createElement('div');
      bar.className = 'hha-vr-bar';
      DOC.body.appendChild(bar);
    }else{
      bar.innerHTML = '';
    }

    const btnFS = DOC.createElement('button');
    btnFS.className = 'hha-vr-btn primary';
    btnFS.textContent = '⛶ Fullscreen / Enter VR';
    btnFS.addEventListener('click', async ()=>{
      unlockAudio();
      if (!isFS()) await enterFS();
      DOC.body.classList.add('view-cvr');
      emit('hha:vr', { state:'enter' });
    });

    const btnExit = DOC.createElement('button');
    btnExit.className = 'hha-vr-btn';
    btnExit.textContent = '⤫ Exit';
    btnExit.addEventListener('click', async ()=>{
      unlockAudio();
      DOC.body.classList.remove('view-cvr');
      emit('hha:vr', { state:'exit' });
      if (isFS()) await exitFS();
    });

    bar.appendChild(btnFS);
    if (allowReset){
      const btnReset = DOC.createElement('button');
      btnReset.className = 'hha-vr-btn';
      btnReset.textContent = '🎯 Reset View';
      btnReset.addEventListener('click', ()=>{
        unlockAudio();
        emit('hha:vr', { state:'reset' });
      });
      bar.appendChild(btnReset);
    }
    bar.appendChild(btnExit);

    // Tap anywhere => shoot at tap coords (engine will pick nearest)
    // VR/Cardboard: ผู้ใช้ “จิ้มจอ” ที่ไหนก็ได้ ยิงได้แน่นอน
    function onShoot(e){
      unlockAudio();
      const x = (e && typeof e.clientX === 'number') ? e.clientX : (root.innerWidth*0.5);
      const y = (e && typeof e.clientY === 'number') ? e.clientY : (root.innerHeight*0.5);
      emit('hha:shoot', { x, y, lockPx });
    }

    // capture phase ให้ยิงได้แม้ element อื่นกัน event
    root.addEventListener('pointerdown', (e)=>{
      // กันยิงตอนกดปุ่ม UI
      const t = e.target;
      if (t && t.classList && (t.classList.contains('hha-vr-btn'))) return;
      onShoot(e);
    }, true);

    // touchstart fallback
    root.addEventListener('touchstart', (e)=>{
      const t = e.touches && e.touches[0];
      if (!t) return;
      onShoot({ clientX:t.clientX, clientY:t.clientY, target:e.target });
    }, { passive:true });

    // shortcut: double click => toggle cVR
    root.addEventListener('dblclick', async ()=>{
      unlockAudio();
      if (!DOC.body.classList.contains('view-cvr')){
        if (!isFS()) await enterFS();
        DOC.body.classList.add('view-cvr');
        emit('hha:vr', { state:'enter' });
      }else{
        DOC.body.classList.remove('view-cvr');
        emit('hha:vr', { state:'exit' });
        if (isFS()) await exitFS();
      }
    });

    // optional: start in cVR if ?cvr=1
    if (qs('cvr','0') === '1'){
      setTimeout(()=> btnFS.click(), 300);
    }
  }

  API.mount = mount;

})(typeof window !== 'undefined' ? window : globalThis);