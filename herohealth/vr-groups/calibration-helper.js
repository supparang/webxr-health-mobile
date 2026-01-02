/* === /herohealth/vr-groups/calibration-helper.js ===
Calibration/Recenter Helper — Cardboard (cVR)
✅ Shows calibration overlay for cVR
✅ Provides Recenter / Continue
✅ Best-effort orientation + fullscreen hints
*/
(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; }
  }
  function isCVR(){
    const v = String(qs('view', DOC.body.className)||'').toLowerCase();
    return v.includes('cvr') || DOC.body.classList.contains('view-cvr');
  }

  function ensureOverlay(){
    let el = DOC.getElementById('calibOverlay');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'calibOverlay';
    el.className = 'overlay overlay-calib hidden';
    el.innerHTML = `
      <div class="panel">
        <div class="title">🧭 CALIBRATE</div>
        <div class="sub" id="calibLine">
          1) กด ENTER VR <br/>
          2) กด RECENTER ให้ crosshair อยู่กลางจอ <br/>
          3) แล้วกด “เริ่มเล่น”
        </div>
        <div class="row row2" style="margin-top:12px;">
          <button id="btnCalibRecenter" class="btn btn-strong" type="button">🧭 Recenter</button>
          <button id="btnCalibOK" class="btn" type="button">✅ เริ่มเล่น</button>
        </div>
        <div class="note" style="margin-top:10px;">
          ถ้าเป้า/มุมมองไหล: กด Recenter ซ้ำได้ตลอด
        </div>
      </div>
    `;
    DOC.body.appendChild(el);

    // buttons
    const $ = (id)=>DOC.getElementById(id);
    $('btnCalibRecenter').addEventListener('click', ()=>{
      try{ root.dispatchEvent(new CustomEvent('hha:recenter', {detail:{}})); }catch(_){}
    });
    $('btnCalibOK').addEventListener('click', ()=>{
      hide();
      try{ root.dispatchEvent(new CustomEvent('groups:calib:ok', {detail:{}})); }catch(_){}
    });

    return el;
  }

  function show(){
    const el = ensureOverlay();
    el.classList.remove('hidden');
    DOC.body.classList.add('calib-on');
  }
  function hide(){
    const el = ensureOverlay();
    el.classList.add('hidden');
    DOC.body.classList.remove('calib-on');
  }

  function autoShowIfNeeded(){
    if (!isCVR()) return;
    // show once per session unless user disabled
    const key = 'HHA_GROUPS_CVR_CALIB_DONE';
    let done = false;
    try{ done = sessionStorage.getItem(key)==='1'; }catch(_){}
    if (!done){
      show();
      try{ sessionStorage.setItem(key,'1'); }catch(_){}
    }
  }

  // public API
  NS.Calibration = {
    show, hide, autoShowIfNeeded
  };

  // run
  DOC.addEventListener('DOMContentLoaded', autoShowIfNeeded, { once:true });

})(typeof window!=='undefined'?window:globalThis);