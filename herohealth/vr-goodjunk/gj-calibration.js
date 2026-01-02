// === /herohealth/vr-goodjunk/gj-calibration.js ===
// GoodJunk — Calibration / Recenter Helper (Cardboard/cVR)

'use strict';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

function keyFor(view){ return `HHA_GJ_AIMPOINT_${String(view||'cvr').toUpperCase()}`; }

function loadAim(view){
  try{
    const raw = localStorage.getItem(keyFor(view));
    if(!raw) return null;
    const o = JSON.parse(raw);
    if(o && Number.isFinite(o.x) && Number.isFinite(o.y)) return { x:o.x|0, y:o.y|0 };
  }catch(_){}
  return null;
}
function saveAim(view, pt){
  try{ localStorage.setItem(keyFor(view), JSON.stringify({ x:pt.x|0, y:pt.y|0, t:Date.now() })); }catch(_){}
}

function defaultAim(){
  return { x:(innerWidth*0.5)|0, y:(innerHeight*0.62)|0 };
}

function ensureOverlay(){
  let wrap = DOC.querySelector('.gj-calib');
  if(wrap) return wrap;

  wrap = DOC.createElement('div');
  wrap.className = 'gj-calib';
  wrap.style.cssText = `
    position:fixed; inset:0; z-index:99997;
    display:none; align-items:center; justify-content:center;
    padding: calc(16px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px));
    background: rgba(0,0,0,.62);
    backdrop-filter: blur(6px);
    color:#e5e7eb;
  `;

  wrap.innerHTML = `
    <div style="
      width:min(720px, 94vw);
      background: rgba(2,6,23,.92);
      border: 1px solid rgba(148,163,184,.22);
      border-radius: 22px;
      padding: 16px 16px 14px;
      box-shadow: 0 20px 60px rgba(0,0,0,.45);
    ">
      <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
        <div style="font: 950 16px/1.2 system-ui;">🧭 Calibration / Recenter (cVR)</div>
        <button id="gj-calib-close" style="
          border:0; border-radius:12px; padding:8px 10px;
          background: rgba(148,163,184,.18); color:#e5e7eb;
          font:900 13px/1 system-ui;
        ">ปิด</button>
      </div>

      <div style="margin-top:10px; opacity:.92; font: 800 13px/1.5 system-ui;">
        1) ถือให้นิ่ง แล้ว “ยิง/แตะ” จุดกลาง 🎯 จำนวน <b id="gj-calib-left">8</b> ครั้ง<br/>
        2) ระบบจะคำนวณจุดเล็งที่แม่นขึ้น และบันทึกไว้ในเครื่อง
      </div>

      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button id="gj-calib-start" style="
          flex:1 1 220px; border:0; border-radius:14px;
          padding:12px 12px; background: rgba(34,197,94,.92);
          color:#04120a; font: 950 14px/1 system-ui;
        ">เริ่ม Calibration</button>

        <button id="gj-calib-reset" style="
          flex:1 1 220px; border:1px solid rgba(148,163,184,.22);
          border-radius:14px; padding:12px 12px;
          background: rgba(148,163,184,.12);
          color:#e5e7eb; font: 950 14px/1 system-ui;
        ">รีเซ็ตเป็นค่าเริ่มต้น</button>
      </div>

      <div style="margin-top:10px; opacity:.72; font: 800 12px/1.35 system-ui;">
        Tip: ถ้าเล็งแล้วหลุด ให้ทำ Calibration ใหม่ 1 รอบ
      </div>
    </div>
  `;

  const dot = DOC.createElement('div');
  dot.className = 'gj-calib-dot';
  dot.style.cssText = `
    position:fixed;
    left:50%; top:50%;
    transform: translate(-50%,-50%);
    width: 18px; height: 18px;
    border-radius: 999px;
    background: rgba(34,197,94,.92);
    box-shadow: 0 0 0 10px rgba(34,197,94,.15);
    z-index:99998;
    display:none;
    pointer-events:none;
  `;
  DOC.body.appendChild(dot);

  DOC.body.appendChild(wrap);
  return wrap;
}

function median(arr){
  const n = arr.length; if(!n) return 0;
  const a = arr.slice().sort((x,y)=>x-y);
  const m = (n/2)|0;
  return (n%2) ? a[m] : (a[m-1]+a[m])/2;
}

export function applyCalibration(view='cvr'){
  const saved = loadAim(view);
  const ap = saved || defaultAim();
  ROOT.__GJ_AIM_POINT__ = { x: ap.x|0, y: ap.y|0 };
}

export function openCalibration(opts = {}){
  const view = String(opts.view || qs('view','cvr') || 'cvr').toLowerCase();
  const shotsNeed = clamp(opts.shotsNeed ?? 8, 5, 15);

  const wrap = ensureOverlay();
  const dot = DOC.querySelector('.gj-calib-dot');
  const $ = (id)=> wrap.querySelector('#'+id);

  let running = false;
  let xs = [];
  let ys = [];
  let left = shotsNeed;

  function setLeft(){ try{ $('#gj-calib-left').textContent = String(left); }catch(_){} }
  function stop(){
    running = false;
    if(dot) dot.style.display = 'none';
    DOC.removeEventListener('pointerdown', onShot, true);
  }
  function close(){ stop(); wrap.style.display = 'none'; }

  function finish(){
    const cx = (innerWidth*0.5);
    const cy = (innerHeight*0.5);

    const mx = median(xs);
    const my = median(ys);

    const dx = mx - cx;
    const dy = my - cy;

    const def = defaultAim();
    const aim = {
      x: clamp(def.x - dx, 0, innerWidth),
      y: clamp(def.y - dy, 0, innerHeight)
    };

    saveAim(view, aim);
    ROOT.__GJ_AIM_POINT__ = { x: aim.x|0, y: aim.y|0 };

    try{ ROOT.dispatchEvent(new CustomEvent('hha:recentered', { detail:{ view, aim } })); }catch(_){}
    close();
  }

  function onShot(ev){
    if(!running) return;
    const x = ev.clientX;
    const y = ev.clientY;
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    xs.push(x); ys.push(y);
    left = Math.max(0, left-1);
    setLeft();

    if(left <= 0){
      stop();
      finish();
    }
  }

  $('#gj-calib-close').onclick = close;

  $('#gj-calib-reset').onclick = ()=>{
    try{ localStorage.removeItem(keyFor(view)); }catch(_){}
    const ap = defaultAim();
    ROOT.__GJ_AIM_POINT__ = { x: ap.x|0, y: ap.y|0 };
    close();
  };

  $('#gj-calib-start').onclick = ()=>{
    xs = []; ys = [];
    left = shotsNeed;
    setLeft();
    running = true;
    if(dot) dot.style.display = 'block';
    DOC.addEventListener('pointerdown', onShot, true);
  };

  setLeft();
  wrap.style.display = 'flex';
}