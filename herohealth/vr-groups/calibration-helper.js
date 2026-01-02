// === /herohealth/vr-groups/calibration-helper.js ===
// PACK 13: Cardboard Calibration/Recenter Helper — PRODUCTION
// - Shows a simple helper overlay for view=cvr
// - Tries to trigger recenter via vr-ui.js (if available) + fallback hints
// - Auto hides on first shoot or after timeout

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }

  const view = String(qs('view','')||'').toLowerCase();
  if (view !== 'cvr') return;

  const KEY = 'HHA_GROUPS_CVR_CALIB_DONE';

  function doneOnce(){
    try{ localStorage.setItem(KEY, '1'); }catch{}
  }
  function isDone(){
    try{ return localStorage.getItem(KEY)==='1'; }catch{ return false; }
  }

  // show each session, but allow skipping if already done
  const force = String(qs('calib','0')||'0');
  if (isDone() && !(force==='1' || force==='true')) return;

  function el(tag, cls, html){
    const x = DOC.createElement(tag);
    if (cls) x.className = cls;
    if (html != null) x.innerHTML = html;
    return x;
  }

  const wrap = el('div','cvr-calib-wrap', `
    <div class="cvr-calib-card">
      <div class="cvr-calib-title">🧭 ตั้งกล้อง / Recenter (Cardboard)</div>
      <div class="cvr-calib-sub">
        1) จับมือถือแนวนอน • 2) มองตรงกลางจอ (crosshair) • 3) กด RECENTER<br/>
        จากนั้น “แตะจอ” เพื่อยิงได้เลย
      </div>
      <div class="cvr-calib-row">
        <button id="cvrBtnRecenter" class="cvr-btn cvr-btn-strong" type="button">🎯 RECENTER</button>
        <button id="cvrBtnHide" class="cvr-btn" type="button">✅ พร้อมแล้ว</button>
      </div>
      <div class="cvr-calib-note">
        ถ้า Enter VR ยังบัง/ทับ UI ให้กด RECENTER อีกครั้ง หรือออก–เข้าใหม่
      </div>
    </div>
  `);

  const style = el('style','', `
    .cvr-calib-wrap{
      position:fixed; inset:0; z-index:160;
      display:flex; align-items:center; justify-content:center;
      padding:18px; pointer-events:auto;
      background: rgba(2,6,23,.62);
      backdrop-filter: blur(10px);
    }
    .cvr-calib-card{
      width:min(560px, 100%);
      border-radius:26px;
      background: rgba(2,6,23,.86);
      border:1px solid rgba(148,163,184,.22);
      box-shadow: 0 24px 70px rgba(0,0,0,.55);
      padding:16px;
      color:#e5e7eb;
      font-family: system-ui,-apple-system,"Segoe UI",sans-serif;
    }
    .cvr-calib-title{
      font-weight:1000; font-size:18px; letter-spacing:.2px;
    }
    .cvr-calib-sub{
      margin-top:8px;
      color:#94a3b8;
      font-weight:800;
      font-size:13px;
      line-height:1.35;
    }
    .cvr-calib-row{ display:flex; gap:10px; margin-top:12px; }
    .cvr-btn{
      flex:1 1 auto;
      display:inline-flex; align-items:center; justify-content:center;
      gap:8px;
      padding:12px 12px;
      border-radius:18px;
      border: 1px solid rgba(148,163,184,.22);
      background: rgba(15,23,42,.65);
      color:#e5e7eb;
      font-weight:1000;
      cursor:pointer;
    }
    .cvr-btn:active{ transform: translateY(1px); }
    .cvr-btn-strong{
      background: rgba(34,197,94,.20);
      border-color: rgba(34,197,94,.38);
    }
    .cvr-calib-note{
      margin-top:10px;
      color:#94a3b8;
      font-weight:800;
      font-size:12px;
    }
  `);

  function hide(){
    try{ wrap.remove(); style.remove(); }catch{}
    doneOnce();
  }

  function tryRecenter(){
    // 1) try vr-ui.js API if exists
    try{
      // If your vr-ui.js exposes something like window.HHA_VRUI.recenter()
      const UI = WIN.HHA_VRUI || WIN.VRUI || null;
      if (UI && typeof UI.recenter === 'function'){ UI.recenter(); }
    }catch(_){}

    // 2) try dispatch a generic event that vr-ui.js may listen to
    try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'calibration-helper' } })); }catch(_){}

    // 3) small fallback: scroll top + focus (helps some mobile browsers)
    try{ WIN.scrollTo(0,0); }catch(_){}
    try{ DOC.body && DOC.body.focus && DOC.body.focus(); }catch(_){}
  }

  DOC.head.appendChild(style);
  DOC.body.appendChild(wrap);

  const btnR = DOC.getElementById('cvrBtnRecenter');
  const btnH = DOC.getElementById('cvrBtnHide');

  btnR && btnR.addEventListener('click', ()=>{
    tryRecenter();
    // quick visual confirm
    btnR.textContent = '✅ RECENTERED';
    setTimeout(()=>{ try{ btnR.textContent='🎯 RECENTER'; }catch{} }, 900);
  });

  btnH && btnH.addEventListener('click', hide);

  // auto-hide on first shoot
  function onShoot(){
    hide();
    WIN.removeEventListener('hha:shoot', onShoot);
  }
  WIN.addEventListener('hha:shoot', onShoot, { passive:true });

  // safety timeout
  setTimeout(()=>{ try{ hide(); }catch{} }, 12000);

})();