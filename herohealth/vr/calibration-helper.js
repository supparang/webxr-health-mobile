// === /herohealth/vr-groups/calibration-helper.js ===
// Pack13: Calibration/Recenter Helper — PRODUCTION
// - Shows calibration overlay for Cardboard/cVR (or when ?calib=1)
// - Provides Recenter button (dispatches hha:recenter) + tries to click vr-ui recenter if exists
// - Auto-hides after a few seconds or when user presses Continue

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function isCVR(){
    return DOC.body.classList.contains('view-cvr') || String(qs('view','')).toLowerCase()==='cvr';
  }
  function isCardboard(){
    // GroupsVR uses view=cardboard in launcher OR you may tag body differently
    return DOC.body.classList.contains('cardboard') || String(qs('view','')).toLowerCase()==='cardboard';
  }

  function ensureOverlay(){
    let el = DOC.getElementById('calibOverlay');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'calibOverlay';
    el.className = 'overlay overlay-calib hidden';
    el.innerHTML = `
      <div class="panel panel-calib">
        <div class="title">🎯 Calibration</div>
        <div class="sub">
          1) ถือมือถือให้นิ่ง แล้วจัด “กึ่งกลางจอ” ให้ตรงกับจุดที่มอง<br>
          2) ถ้าเอียง/เพี้ยน ให้กด <b>RECENTER</b><br>
          3) จากนั้นกด <b>CONTINUE</b>
        </div>

        <div class="calibDotWrap" aria-hidden="true">
          <div class="calibDot"></div>
        </div>

        <div class="row row2" style="margin-top:12px;">
          <button id="btnRecenterHelper" class="btn btn-strong" type="button">🧭 RECENTER</button>
          <button id="btnCalibContinue" class="btn" type="button">✅ CONTINUE</button>
        </div>

        <div class="note" style="margin-top:10px;">
          Tip: ถ้าใช้ Cardboard ให้ “มองตรง” ก่อนกด RECENTER
        </div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function tryClickVrUiRecenter(){
    // vr-ui.js typically renders buttons; try common selectors safely
    const candidates = [
      '.vrui-btn-recenter', '#vruiRecenter', '[data-vrui="recenter"]', 'button[title*="RECENTER" i]'
    ];
    for (const sel of candidates){
      const b = DOC.querySelector(sel);
      if (b && typeof b.click === 'function'){ try{ b.click(); return true; }catch{} }
    }
    return false;
  }

  function recenter(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:recenter')); }catch{}
    // best effort: click vr-ui recenter if exists
    tryClickVrUiRecenter();
    // tiny haptic
    try{ navigator.vibrate && navigator.vibrate([18,30,18]); }catch{}
  }

  function showCalib(){
    const ov = ensureOverlay();
    ov.classList.remove('hidden');

    const btnR = DOC.getElementById('btnRecenterHelper');
    const btnC = DOC.getElementById('btnCalibContinue');

    btnR && btnR.addEventListener('click', recenter);
    btnC && btnC.addEventListener('click', ()=> ov.classList.add('hidden'));

    // auto-hide after a moment (still can reopen via ?calib=1)
    setTimeout(()=>{ ov.classList.add('hidden'); }, 6500);
  }

  // Trigger conditions:
  // - Cardboard/cVR
  // - or forced with ?calib=1
  const force = String(qs('calib','0')||'0');
  const should = (force==='1' || force==='true' || isCVR() || isCardboard());

  // show after view is set
  if (should){
    setTimeout(showCalib, 450);
  }

  // Optional: recenter on start if ?recenter=1
  const autoR = String(qs('recenter','0')||'0');
  if (autoR==='1' || autoR==='true'){
    WIN.addEventListener('hha:start', ()=> setTimeout(recenter, 180), { once:true });
  }
})();