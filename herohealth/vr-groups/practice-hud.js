/* === /herohealth/vr-groups/practice-hud.js ===
PACK 14: Practice HUD (15s for cVR)
✅ Shows overlay when vMode = PRACTICE
✅ Auto hides when real run starts
✅ Minimal + safe (pointer-events none)
*/
(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  function $(q){ return DOC.querySelector(q); }

  function ensure(){
    let wrap = $('.practice-hud');
    if (wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.className = 'practice-hud hidden';
    wrap.innerHTML = `
      <div class="ph-card">
        <div class="ph-title">🧪 PRACTICE (ซ้อมก่อนเริ่มจริง)</div>
        <div class="ph-list">
          <div class="ph-item">🎯 เล็ง crosshair กลางจอ แล้ว “แตะจอ” เพื่อยิง</div>
          <div class="ph-item">✅ ยิง “หมู่ที่ถูก” เท่านั้น</div>
          <div class="ph-item">🗑️ หลีกเลี่ยงขยะ / หมู่ผิด</div>
        </div>
        <div class="ph-tip">Tip: ถ้าเป้าไม่ตรง ให้กด RECENTER (ปุ่มขวาบน)</div>
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function show(on){
    const wrap = ensure();
    wrap.classList.toggle('hidden', !on);
  }

  // When mode switches in HUD
  function check(){
    const v = DOC.getElementById('vMode');
    const mode = v ? String(v.textContent||'').toUpperCase() : '';
    show(mode === 'PRACTICE');
  }

  // poll lightly (safe)
  let tmr = 0;
  function loop(){
    clearTimeout(tmr);
    check();
    tmr = setTimeout(loop, 250);
  }
  loop();

  // hide when end overlay shows
  root.addEventListener('hha:end', ()=>show(false), {passive:true});

})(typeof window !== 'undefined' ? window : globalThis);