// === /herohealth/vr-groups/calibrate.js ===
// PACK 13: Calibration / Recenter helper for Cardboard(cVR)
// - Shows quick helper overlay when view=cvr (or body.view-cvr)
// - Provides "Calibrate" action storing small offsets (optional)
// - Emits: groups:calibrate {ok, offsetX, offsetY, ts}
// Note: vr-ui.js already has RECENTER. This helper is for user guidance + optional offsets.

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function isCVR(){
    const cls = DOC.body.className || '';
    if (cls.includes('view-cvr')) return true;
    return String(qs('view','')||'').toLowerCase().includes('cvr');
  }

  const LS_KEY = 'HHA_GROUPS_CALIB';

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  function ensureOverlay(){
    let el = DOC.getElementById('calibOverlay');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'calibOverlay';
    el.style.cssText = `
      position:fixed; inset:0; z-index:120;
      display:flex; align-items:flex-end; justify-content:center;
      padding: 14px 14px calc(18px + env(safe-area-inset-bottom,0px));
      pointer-events:none;
    `;

    el.innerHTML = `
      <div class="calibCard" style="
        width:min(560px,100%);
        border-radius:22px;
        background: rgba(2,6,23,.72);
        border: 1px solid rgba(148,163,184,.18);
        box-shadow: 0 18px 52px rgba(0,0,0,.45);
        backdrop-filter: blur(10px);
        padding: 12px 12px 10px;
        pointer-events:auto;
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="font:900 13px/1.2 system-ui;color:#e5e7eb;">
            🎯 Calibrate (Cardboard)
          </div>
          <button id="btnCalibClose" type="button" style="
            border:1px solid rgba(148,163,184,.20);
            background: rgba(15,23,42,.55);
            color:#e5e7eb;
            border-radius:999px;
            padding:6px 10px;
            font:900 12px/1 system-ui;
            cursor:pointer;
          ">ปิด</button>
        </div>

        <div style="margin-top:8px;color:#94a3b8;font:800 12px/1.35 system-ui;">
          1) หันหน้าตรงที่ต้องการ • 2) กด <b>RECENTER</b> (ปุ่ม vr-ui) • 3) แตะ “Calibrate” เพื่อจำศูนย์  
          <br/>Tip: ถ้า crosshair ไม่ตรงเป้า ให้ทำซ้ำได้
        </div>

        <div style="display:flex;gap:10px;margin-top:10px;">
          <button id="btnCalibNow" type="button" style="
            flex:1 1 auto;
            border:1px solid rgba(34,197,94,.35);
            background: rgba(34,197,94,.18);
            color:#e5e7eb;
            border-radius:18px;
            padding:10px 12px;
            font:1000 13px/1 system-ui;
            cursor:pointer;
          ">✅ Calibrate ตอนนี้</button>

          <button id="btnCalibReset" type="button" style="
            flex:1 1 auto;
            border:1px solid rgba(148,163,184,.20);
            background: rgba(15,23,42,.55);
            color:#e5e7eb;
            border-radius:18px;
            padding:10px 12px;
            font:1000 13px/1 system-ui;
            cursor:pointer;
          ">🧹 Reset</button>
        </div>
      </div>
    `;

    DOC.body.appendChild(el);
    return el;
  }

  function hide(){
    const el = DOC.getElementById('calibOverlay');
    if (el) el.remove();
  }

  function read(){
    try{ return JSON.parse(localStorage.getItem(LS_KEY)||'{}') || {}; }catch{ return {}; }
  }

  function write(v){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(v||{})); }catch{}
  }

  function calibrateNow(){
    // We store offsets relative to current viewport center (optional).
    // In future, view-helper can use this for subtle translate compensation.
    const x = WIN.innerWidth/2;
    const y = WIN.innerHeight/2;

    const data = {
      ok: true,
      offsetX: 0,
      offsetY: 0,
      cx: x, cy: y,
      ts: Date.now()
    };

    write(data);
    emit('groups:calibrate', data);

    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach',{
        detail:{ text:'Calibrate แล้ว ✅ ถ้ายังไม่ตรง กด RECENTER แล้วทำซ้ำได้', mood:'happy' }
      }));
    }catch(_){}
  }

  function reset(){
    write({ ok:false, offsetX:0, offsetY:0, ts: Date.now() });
    emit('groups:calibrate', { ok:false, offsetX:0, offsetY:0, ts: Date.now() });

    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach',{
        detail:{ text:'รีเซ็ต Calibration แล้ว 🧹', mood:'neutral' }
      }));
    }catch(_){}
  }

  function boot(){
    if (!isCVR()) return;

    // show overlay once per session (unless debug=0 forced)
    const dbg = String(qs('debug','0')||'0');
    if (dbg === '0'){
      // still show once (cVR users need it), but allow user close
    }

    const el = ensureOverlay();
    const btnClose = DOC.getElementById('btnCalibClose');
    const btnNow   = DOC.getElementById('btnCalibNow');
    const btnReset = DOC.getElementById('btnCalibReset');

    if (btnClose) btnClose.addEventListener('click', hide);
    if (btnNow)   btnNow.addEventListener('click', ()=>{ calibrateNow(); hide(); });
    if (btnReset) btnReset.addEventListener('click', ()=>{ reset(); });
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

})();