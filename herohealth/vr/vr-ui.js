/* === /herohealth/vr/vr-ui.js ===
HHA VR UI (Shared) — Enter VR + Exit + Gyro permission + Crosshair + Tap-to-Shoot
✅ Works for ALL games (DOM-based) by emitting events:
   - hha:vr {state:'enter'|'exit'|'reset'}
   - hha:shoot {x,y, lockPx}
✅ Adds floating buttons + crosshair overlay automatically
✅ Reads URL params:
   - view = pc | mobile | vr | cvr
   - cvr=1 => view=cvr
   - tapshoot=1 => enable tap-to-shoot
*/
(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const $ = (sel, el=DOC)=> el.querySelector(sel);
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  function qs(k, def=null){
    try{ return new URL(root.location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // ---------- View mode ----------
  function getView(){
    const v = String(qs('view','')||'').toLowerCase();
    if (v) return v;
    if (qs('cvr','0') === '1') return 'cvr';
    // auto guess
    const w = root.innerWidth||360;
    return (w <= 520) ? 'mobile' : 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    if (!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add(`view-${view}`);
  }

  // ---------- Fullscreen helpers ----------
  function isFs(){
    return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
  }
  async function enterFs(){
    try{
      const el = DOC.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI:'hide' });
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
      const so = root.screen && root.screen.orientation;
      if (so && so.lock) await so.lock('landscape');
    }catch(_){}
  }

  async function requestGyro(){
    // iOS requires permission from user gesture
    try{
      const DOE = root.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function'){
        const r = await DOE.requestPermission();
        return (r === 'granted');
      }
      return true;
    }catch(_){
      return false;
    }
  }

  // ---------- UI inject ----------
  function ensureCss(){
    if ($('#hha-vrui-style')) return;
    const st = DOC.createElement('style');
    st.id = 'hha-vrui-style';
    st.textContent = `
      .hha-vrui{
        position:fixed; left:12px; bottom:12px;
        z-index:999; display:flex; gap:8px; flex-wrap:wrap;
        pointer-events:auto;
      }
      .hha-vbtn{
        border:1px solid rgba(148,163,184,.22);
        background:rgba(2,6,23,.72);
        color:#e5e7eb;
        padding:10px 12px;
        border-radius:999px;
        font:900 12px/1 system-ui;
        box-shadow:0 16px 40px rgba(0,0,0,.35);
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      .hha-vbtn.primary{
        background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.90));
        color:#061018;
        border:0;
      }
      .hha-vbtn.on{
        border-color:rgba(34,211,238,.45);
        box-shadow:0 0 0 3px rgba(34,211,238,.12), 0 16px 40px rgba(0,0,0,.35);
      }
      .hha-crosshair{
        position:fixed; left:50%; top:50%;
        transform:translate(-50%,-50%);
        z-index:950; pointer-events:none;
        width:26px; height:26px; border-radius:999px;
        border:2px solid rgba(226,232,240,.85);
        box-shadow:0 0 0 3px rgba(34,211,238,.12), 0 12px 28px rgba(0,0,0,.35);
        display:none;
      }
      .hha-crosshair:before{
        content:"";
        position:absolute; left:50%; top:50%;
        transform:translate(-50%,-50%);
        width:4px; height:4px; border-radius:999px;
        background:rgba(34,211,238,.95);
      }
      body.view-cvr .hha-crosshair{ display:block; }
      body.view-cvr .hha-vrui{ left:12px; right:12px; bottom:12px; justify-content:center; }
    `;
    DOC.head.appendChild(st);
  }

  function ensureUI(){
    ensureCss();
    if ($('#hha-vrui')) return;

    const wrap = DOC.createElement('div');
    wrap.id = 'hha-vrui';
    wrap.className = 'hha-vrui';

    const btnEnter = DOC.createElement('button');
    btnEnter.className = 'hha-vbtn primary';
    btnEnter.textContent = '🕶️ Enter VR';

    const btnExit = DOC.createElement('button');
    btnExit.className = 'hha-vbtn';
    btnExit.textContent = '⤴ Exit';

    const btnGyro = DOC.createElement('button');
    btnGyro.className = 'hha-vbtn';
    btnGyro.textContent = '🧭 Gyro';

    const btnReset = DOC.createElement('button');
    btnReset.className = 'hha-vbtn';
    btnReset.textContent = '🎯 Reset';

    const btnTap = DOC.createElement('button');
    btnTap.className = 'hha-vbtn';
    btnTap.textContent = '🔫 TapShoot';

    wrap.append(btnEnter, btnExit, btnGyro, btnReset, btnTap);
    DOC.body.appendChild(wrap);

    const cross = DOC.createElement('div');
    cross.className = 'hha-crosshair';
    cross.id = 'hha-crosshair';
    DOC.body.appendChild(cross);

    let tapShoot = (qs('tapshoot','0') === '1') || (getView()==='cvr');
    if (tapShoot) btnTap.classList.add('on');

    btnEnter.addEventListener('click', async ()=>{
      await enterFs();
      await lockLandscape();
      setBodyView('cvr');
      emit('hha:vr', { state:'enter', view:'cvr' });
    });

    btnExit.addEventListener('click', async ()=>{
      emit('hha:vr', { state:'exit' });
      await exitFs();
    });

    btnGyro.addEventListener('click', async ()=>{
      const ok = await requestGyro();
      btnGyro.classList.toggle('on', !!ok);
      emit('hha:vr', { state:'gyro', granted: !!ok });
    });

    btnReset.addEventListener('click', ()=>{
      emit('hha:vr', { state:'reset' });
    });

    btnTap.addEventListener('click', ()=>{
      tapShoot = !tapShoot;
      btnTap.classList.toggle('on', tapShoot);
    });

    // tap-to-shoot (center)
    DOC.addEventListener('pointerdown', (ev)=>{
      if (!tapShoot) return;
      if (!DOC.body.classList.contains('view-cvr')) return;
      // ignore clicks on buttons
      const t = ev.target;
      if (t && (t.closest && t.closest('#hha-vrui'))) return;

      const x = (root.innerWidth||0) * 0.5;
      const y = (root.innerHeight||0) * 0.5;
      const lockPx = clamp(Number(qs('lockPx','86')||86), 40, 160);

      emit('hha:shoot', { x, y, lockPx });
    }, { passive:true });
  }

  function boot(){
    setBodyView(getView());
    ensureUI();
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  root.HHAVRUI = { boot };

})(typeof window!=='undefined'?window:globalThis);