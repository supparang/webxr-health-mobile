/* === /herohealth/vr/hha-vr-tapfire.js ===
   HHA Shared: Tap-to-Fire (Cardboard/cVR)
   - เมื่อ body.view-cvr => แตะที่ไหนก็ได้ ยิงเป้าที่ใกล้ crosshair (กลางจอ) ที่สุด
   - รองรับทุกเกมที่ใช้ DOM targets (class .fg-target หรือกำหนด selector เอง)
   - มี crosshair overlay ให้ด้วย
*/

(function(root){
  'use strict';

  const DOC = root.document;
  if(!DOC) return;

  const API = (root.HHAVRTapFire = root.HHAVRTapFire || {});
  let _installed = false;
  let _cfg = null;
  let _cross = null;

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function isCVR(){
    try{ return DOC.body.classList.contains('view-cvr'); }catch{ return false; }
  }

  function requestFullscreen(){
    try{
      const el = DOC.documentElement;
      if (DOC.fullscreenElement || DOC.webkitFullscreenElement) return Promise.resolve();
      if (el.requestFullscreen) return el.requestFullscreen();
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    }catch(_){}
    return Promise.resolve();
  }

  function lockLandscape(){
    try{
      const scr = root.screen;
      if (scr && scr.orientation && scr.orientation.lock){
        return scr.orientation.lock('landscape').catch(()=>{});
      }
    }catch(_){}
    return Promise.resolve();
  }

  function ensureCrosshair(){
    if(_cross && _cross.isConnected) return _cross;
    const el = DOC.createElement('div');
    el.className = 'hha-crosshair';
    el.setAttribute('aria-hidden','true');
    el.style.cssText = `
      position:fixed; left:50%; top:50%;
      transform:translate(-50%,-50%);
      z-index:999;
      pointer-events:none;
      width:28px; height:28px;
      opacity:.0;
      transition: opacity .18s ease;
    `;
    el.innerHTML = `
      <div style="
        position:absolute; inset:0;
        border:2px solid rgba(255,255,255,.85);
        border-radius:999px;
        box-shadow:0 0 0 3px rgba(34,211,238,.22), 0 16px 30px rgba(0,0,0,.35);
      "></div>
      <div style="
        position:absolute; left:50%; top:50%;
        width:2px; height:18px; background:rgba(255,255,255,.9);
        transform:translate(-50%,-50%);
        border-radius:2px;
      "></div>
      <div style="
        position:absolute; left:50%; top:50%;
        width:18px; height:2px; background:rgba(255,255,255,.9);
        transform:translate(-50%,-50%);
        border-radius:2px;
      "></div>
    `;
    DOC.body.appendChild(el);
    _cross = el;
    return el;
  }

  function setCrossVisible(on){
    const el = ensureCrosshair();
    el.style.opacity = on ? '1' : '0';
  }

  function defaultPlayRect(){
    const W = root.innerWidth || 360;
    const H = root.innerHeight || 640;

    // กัน HUD บน + power/coach ล่างแบบปลอดภัย (ปรับได้ผ่าน cfg.margins)
    const top  = 160;
    const bot  = 210;
    const side = 16;

    return { x0: side, y0: top, x1: W-side, y1: H-bot, W, H };
  }

  function getPlayRect(){
    if(_cfg && typeof _cfg.getPlayRect === 'function'){
      const r = _cfg.getPlayRect();
      if(r && isFinite(r.x0) && isFinite(r.y0) && isFinite(r.x1) && isFinite(r.y1)) return r;
    }
    const m = (_cfg && _cfg.margins) ? _cfg.margins : null;
    if(m){
      const W = root.innerWidth || 360;
      const H = root.innerHeight || 640;
      const top  = Math.max(0, Number(m.top  ?? 160));
      const bot  = Math.max(0, Number(m.bottom?? 210));
      const side = Math.max(0, Number(m.side ?? 16));
      return { x0: side, y0: top, x1: W-side, y1: H-bot, W, H };
    }
    return defaultPlayRect();
  }

  function pickClosestTarget(){
    if(!_cfg) return null;

    const layer = _cfg.layerEl || (typeof _cfg.getLayerEl === 'function' ? _cfg.getLayerEl() : null);
    if(!layer) return null;

    const selector = _cfg.selector || '.fg-target';
    const list = layer.querySelectorAll(selector);
    if(!list || !list.length) return null;

    const r = getPlayRect();
    const cx = (r.x0 + r.x1) * 0.5;
    const cy = (r.y0 + r.y1) * 0.5;

    let best = null;
    let bestD = 1e18;

    list.forEach(el=>{
      const b = el.getBoundingClientRect();
      const ex = b.left + b.width/2;
      const ey = b.top  + b.height/2;
      const dx = ex - cx, dy = ey - cy;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD){ bestD = d2; best = el; }
    });

    return { el: best, d2: bestD };
  }

  function fire(){
    if(!_cfg) return;

    const active = (_cfg.isActive ? _cfg.isActive() : true);
    if(!active) return;

    const picked = pickClosestTarget();
    if(!picked || !picked.el) return;

    const lockPx = Number(_cfg.lockPx || (isCVR() ? 120 : 80));
    if(picked.d2 > lockPx*lockPx) return;

    try{
      if(typeof _cfg.hit === 'function') _cfg.hit(picked.el);
    }catch(_){}
  }

  function onPointerDown(e){
    if(!_cfg) return;

    // ยิงแบบนี้เฉพาะใน cVR เท่านั้น
    if(!isCVR()) return;

    // กัน event ไปชน layer/targets ทำให้กดแล้วโดนอะไรอื่น
    try{
      e.preventDefault();
      e.stopPropagation();
    }catch(_){}

    fire();
  }

  function onKeyDown(e){
    if(!isCVR()) return;
    const k = String(e.key||'').toLowerCase();
    if(k === ' ' || k === 'enter'){
      try{ e.preventDefault(); }catch(_){}
      fire();
    }
  }

  API.install = function install(cfg){
    _cfg = cfg || {};
    if(_installed) return API;
    _installed = true;

    // show crosshair when in cVR
    setCrossVisible(isCVR());

    root.addEventListener('pointerdown', onPointerDown, { passive:false, capture:true });
    root.addEventListener('keydown', onKeyDown, { passive:false });

    // auto toggle crosshair when view changes (simple polling)
    let last = isCVR();
    API._poll = root.setInterval(()=>{
      const cur = isCVR();
      if(cur !== last){
        last = cur;
        setCrossVisible(cur);
      }
    }, 220);

    return API;
  };

  API.uninstall = function uninstall(){
    if(!_installed) return;
    _installed = false;

    try{ root.removeEventListener('pointerdown', onPointerDown, { capture:true }); }catch(_){}
    try{ root.removeEventListener('keydown', onKeyDown); }catch(_){}

    try{ root.clearInterval(API._poll); }catch(_){}
    API._poll = 0;

    try{ if(_cross && _cross.isConnected) _cross.remove(); }catch(_){}
    _cross = null;
    _cfg = null;
  };

  API.enterCVR = async function enterCVR(){
    try{
      DOC.body.classList.add('view-cvr');
      DOC.body.classList.remove('view-pc','view-mobile','view-vr');
      await requestFullscreen();
      await lockLandscape();
      setCrossVisible(true);
    }catch(_){}
  };

})(typeof window !== 'undefined' ? window : globalThis);