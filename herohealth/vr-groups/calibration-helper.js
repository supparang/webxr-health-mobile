// === /herohealth/vr-groups/calibration-helper.js ===
// PACK 67: Cardboard Calibration / Recenter Helper (safe, UI-only)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function isCVR(){
    const v = String(qs('view','')||'').toLowerCase();
    return v.includes('cvr') || DOC.body.classList.contains('view-cvr');
  }

  function ensure(){
    let el = DOC.querySelector('.cvr-calib');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'cvr-calib hidden';
    el.innerHTML = `
      <div class="cc-panel">
        <div class="cc-title">🧭 ตั้งค่า Cardboard (cVR)</div>
        <div class="cc-sub">
          1) จับมือถือให้นิ่ง • 2) กด RECENTER • 3) เล็งกากบาทกลางจอให้ตรงเป้า
        </div>

        <div class="cc-steps">
          <div class="cc-step"><span class="n">1</span><span>ถือให้นิ่ง หันไปทาง “กึ่งกลางสนาม”</span></div>
          <div class="cc-step"><span class="n">2</span><span>กดปุ่ม <b>RECENTER</b> (มุมบน)</span></div>
          <div class="cc-step"><span class="n">3</span><span>แตะจอเพื่อยิงจาก <b>crosshair</b></span></div>
        </div>

        <div class="cc-row">
          <button type="button" class="cc-btn" id="ccTry">🕶️ เข้าโหมด Cardboard</button>
          <button type="button" class="cc-btn cc-strong" id="ccOk">✅ พร้อมเล่น</button>
        </div>
        <div class="cc-note">* ถ้าเล็งแล้วเพี้ยน ให้กด RECENTER อีกครั้ง</div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  function show(){ ensure().classList.remove('hidden'); }
  function hide(){ ensure().classList.add('hidden'); }

  function bind(){
    const el = ensure();
    el.querySelector('#ccTry')?.addEventListener('click', ()=>{
      try{
        const H = WIN.GroupsVR && WIN.GroupsVR.ViewHelper;
        if (H && H.tryImmersiveForCVR) H.tryImmersiveForCVR();
      }catch(_){}
    });
    el.querySelector('#ccOk')?.addEventListener('click', ()=>{
      hide();
      try{ DOC.body.classList.add('cvr-calib-done'); }catch(_){}
    });
  }

  function boot(){
    if (!isCVR()) return;
    const off = String(qs('calib','1')||'1'); // default ON
    if (off === '0' || off === 'false') return;

    bind();
    const done = DOC.body.classList.contains('cvr-calib-done');
    if (!done) setTimeout(show, 380);
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();
})();