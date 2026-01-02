/* === /herohealth/vr-groups/cvr-calibrate.js ===
PACK 13: cVR Calibration / Recenter Helper
✅ Tap-to-set crosshair center offset (store in localStorage)
✅ Recenter event hook (hha:recenter) + keyboard "R"
✅ Safe clamp offsets
Exports:
  window.GroupsVR.CVRCalib = { getOffset(), setOffset(x,y), clear(), ensureUI() }
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  const KEY = 'HHA_CVR_CENTER_OFF_v1';

  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }

  function load(){
    try{
      const obj = JSON.parse(localStorage.getItem(KEY)||'null');
      if (!obj) return { x:0, y:0, ok:false };
      return {
        x: clamp(obj.x, -160, 160),
        y: clamp(obj.y, -160, 160),
        ok: !!obj.ok
      };
    }catch{
      return { x:0, y:0, ok:false };
    }
  }
  function save(x,y,ok){
    try{
      localStorage.setItem(KEY, JSON.stringify({
        x: clamp(x,-160,160),
        y: clamp(y,-160,160),
        ok: !!ok
      }));
    }catch{}
  }

  let state = load();

  function isCVR(){
    try{ return DOC.body.classList.contains('view-cvr'); }catch{ return false; }
  }

  // ----- Minimal UI -----
  function ensureUI(){
    if (DOC.getElementById('cvrCalibOverlay')) return;
    const wrap = DOC.createElement('div');
    wrap.id = 'cvrCalibOverlay';
    wrap.style.cssText = `
      position:fixed; inset:0; z-index:999;
      display:none; align-items:center; justify-content:center;
      background: rgba(0,0,0,.45);
      backdrop-filter: blur(6px);
      padding: 16px;
    `;
    wrap.innerHTML = `
      <div style="
        width:min(520px, 94vw);
        background: rgba(2,6,23,.82);
        border: 1px solid rgba(148,163,184,.22);
        border-radius: 18px;
        padding: 14px 14px 12px;
        color: #e5e7eb;
        box-shadow: 0 30px 90px rgba(0,0,0,.55);
        font: 600 14px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
      ">
        <div style="font-size:16px; font-weight:900;">🎯 ตั้งศูนย์กลาง (Cardboard / cVR)</div>
        <div style="opacity:.9; margin-top:6px;">
          1) มองให้ crosshair อยู่ “กลางที่คุณรู้สึกว่าใช่” <br/>
          2) <b>แตะจอ 1 ครั้ง</b> เพื่อบันทึกศูนย์กลาง (offset) <br/>
          3) ถ้าคลาด: กด <b>Recenter</b> (vr-ui) หรือกดปุ่ม <b>R</b>
        </div>
        <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
          <button id="cvrBtnClear" style="
            appearance:none; border:1px solid rgba(148,163,184,.26);
            background: rgba(15,23,42,.55);
            color:#e5e7eb; padding:10px 12px; border-radius:999px;
            font-weight:900; cursor:pointer;
          ">♻️ ล้างค่า</button>
          <button id="cvrBtnClose" style="
            appearance:none; border:1px solid rgba(34,197,94,.35);
            background: rgba(34,197,94,.16);
            color:#e5e7eb; padding:10px 12px; border-radius:999px;
            font-weight:900; cursor:pointer;
          ">✅ พร้อมแล้ว</button>
          <div style="margin-left:auto; opacity:.75; font-weight:700;">
            tip: ยิงด้วย crosshair → hha:shoot
          </div>
        </div>
      </div>
    `;
    DOC.body.appendChild(wrap);

    const close = wrap.querySelector('#cvrBtnClose');
    const clear = wrap.querySelector('#cvrBtnClear');

    close && close.addEventListener('click', ()=>{
      wrap.style.display='none';
    });
    clear && clear.addEventListener('click', ()=>{
      state = { x:0, y:0, ok:false };
      save(0,0,false);
      try{ root.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:'ล้างค่า center แล้ว ✅ แตะจออีกครั้งเพื่อเซ็ตใหม่', mood:'neutral'}})); }catch{}
    });
  }

  function showUI(){
    ensureUI();
    const el = DOC.getElementById('cvrCalibOverlay');
    if (el) el.style.display='flex';
  }

  // tap-to-set offset (only when overlay visible OR first time)
  function bindTap(){
    let armed = false;

    function armIfNeeded(){
      if (!isCVR()) return;
      // show UI when not calibrated yet
      if (!state.ok) showUI();
      armed = true;
    }

    // arm on start (best-effort)
    setTimeout(armIfNeeded, 650);

    DOC.addEventListener('pointerdown', (ev)=>{
      if (!isCVR()) return;
      // allow set when overlay shown OR not calibrated yet
      const ov = DOC.getElementById('cvrCalibOverlay');
      const ovOn = ov && ov.style.display === 'flex';
      if (!ovOn && state.ok) return;

      const W = Math.max(320, root.innerWidth||360);
      const H = Math.max(420, root.innerHeight||640);
      const x = Number(ev.clientX||0);
      const y = Number(ev.clientY||0);

      // offset relative to true center
      const dx = clamp(x - W/2, -160, 160);
      const dy = clamp(y - H/2, -160, 160);

      state = { x: dx, y: dy, ok:true };
      save(dx,dy,true);

      try{
        root.dispatchEvent(new CustomEvent('hha:judge',{detail:{kind:'perfect', text:'CENTER SET'}}));
        root.dispatchEvent(new CustomEvent('hha:coach',{detail:{text:`ตั้งศูนย์กลางแล้ว ✅ (dx=${dx|0}, dy=${dy|0})`, mood:'happy'}}));
      }catch{}

      if (ov) ov.style.display = 'none';
      armed = false;
    }, { passive:true });

    // recenter hotkey
    DOC.addEventListener('keydown', (ev)=>{
      if (!isCVR()) return;
      if ((ev.key||'').toLowerCase()==='r'){
        clearOffset();
      }
    });

    // recenter event from vr-ui.js (if you emit it later)
    root.addEventListener('hha:recenter', ()=>{
      clearOffset();
    }, {passive:true});
  }

  function getOffset(){ return { x: state.x||0, y: state.y||0, ok: !!state.ok }; }
  function setOffset(x,y){
    state = { x: clamp(x,-160,160), y: clamp(y,-160,160), ok:true };
    save(state.x,state.y,true);
  }
  function clearOffset(){
    state = { x:0, y:0, ok:false };
    save(0,0,false);
    showUI();
  }

  ensureUI();
  bindTap();

  NS.CVRCalib = { getOffset, setOffset, clear: clearOffset, ensureUI };
})(typeof window!=='undefined'?window:globalThis);