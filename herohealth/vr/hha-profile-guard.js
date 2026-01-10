// === /herohealth/vr/hha-profile-guard.js ===
// HHA Profile Guard — PRODUCTION
// ✅ Injects: "Play without profile" (for play mode) + "Edit profile" helper
// ✅ Enforces: in research mode => studentKey required + consentParent === 'Y'
// ✅ Blocks start by setting window.__HHA_START_BLOCKED__ and showing overlay message
// ✅ Works with any game having #startOverlay (optional)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!WIN || !DOC) return;
  if (WIN.__HHA_PROFILE_GUARD__) return;
  WIN.__HHA_PROFILE_GUARD__ = true;

  const qs = (k, def='')=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const run = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();

  function getProfile(){
    try{ return WIN.HHA_PROFILE?.get?.() || {}; }catch(_){ return {}; }
  }

  function setBlocked(on){
    WIN.__HHA_START_BLOCKED__ = !!on;
  }

  function ensureBox(){
    const overlay = DOC.getElementById('startOverlay');
    if (!overlay) return null;

    let box = DOC.getElementById('hhaProfileGuardBox');
    if (box) return box;

    const host = overlay.querySelector('.card') || overlay;
    box = DOC.createElement('div');
    box.id = 'hhaProfileGuardBox';
    box.style.cssText = `
      margin-top:12px;
      border:1px solid rgba(239,68,68,.22);
      background:rgba(239,68,68,.08);
      border-radius:18px;
      padding:12px;
      display:none;
    `;
    box.innerHTML = `
      <div style="font-weight:900;letter-spacing:.2px;">⚠️ Research mode: ต้องมีข้อมูลยินยอม</div>
      <div id="hhaProfileGuardMsg" style="margin-top:6px;color:rgba(229,231,235,.92);font-size:12px;line-height:1.35;white-space:pre-line;"></div>
      <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
        <button class="btn cyan" id="btnGuardEditProfile">✍️ กรอก/แก้ไขโปรไฟล์</button>
        <button class="btn" id="btnGuardReload">↻ Reload</button>
      </div>
    `;
    host.appendChild(box);

    // actions
    DOC.getElementById('btnGuardReload')?.addEventListener('click', ()=>{
      const u = new URL(location.href);
      u.searchParams.set('ts', String(Date.now()));
      location.href = u.toString();
    });

    DOC.getElementById('btnGuardEditProfile')?.addEventListener('click', ()=>{
      // ถ้ามี profile-ui.js อยู่แล้ว มันจะอยู่ใน overlay ให้กรอกได้เลย
      // แค่ scroll ไปส่วนโปรไฟล์
      const p = DOC.getElementById('hhaProfileBox');
      if (p && p.scrollIntoView) p.scrollIntoView({ behavior:'smooth', block:'start' });
    });

    return box;
  }

  function showGuard(msg){
    const box = ensureBox();
    if (!box) return;
    const m = DOC.getElementById('hhaProfileGuardMsg');
    if (m) m.textContent = String(msg || '');
    box.style.display = 'block';
  }

  function hideGuard(){
    const box = DOC.getElementById('hhaProfileGuardBox');
    if (box) box.style.display = 'none';
  }

  function ensureExtraButtons(){
    const overlay = DOC.getElementById('startOverlay');
    if (!overlay) return;

    // ใส่ปุ่มเพิ่มใน .btnRow (ถ้ามี)
    const row = overlay.querySelector('.btnRow') || overlay;
    if (!row) return;

    if (!DOC.getElementById('btnQuickPlayNoProfile')){
      const b = DOC.createElement('button');
      b.className = 'btn';
      b.id = 'btnQuickPlayNoProfile';
      b.textContent = '⚡ Play without profile (เฉพาะเล่นปกติ)';
      b.style.display = (run === 'research') ? 'none' : 'inline-flex';

      b.addEventListener('click', async ()=>{
        // ยอมให้เริ่มเล่นแบบไม่ต้องกรอก (play mode เท่านั้น)
        setBlocked(false);
        hideGuard();

        // ถ้าหน้านี้ต้องเลือก view ก่อน ให้แค่ set flag แล้วผู้ใช้กด view ต่อได้
        try{
          localStorage.setItem('HHA_SKIP_PROFILE_ONCE', '1');
        }catch(_){}
        // แสดง hint เล็ก ๆ
        alert('เริ่มโหมดเล่นปกติได้เลย ✅ (research mode จะบังคับกรอก/ยินยอม)');
      });

      row.appendChild(b);
    }
  }

  function validateForResearch(){
    if (run !== 'research') return { ok:true, msg:'' };

    const p = getProfile();
    const studentKey = String(p.studentKey || '').trim();
    const consent = String(p.consentParent || '').trim().toUpperCase();

    const missing = [];
    if (!studentKey) missing.push('• ต้องมี studentKey');
    if (consent !== 'Y') missing.push('• consentParent ต้องเป็น Y');

    if (missing.length){
      return {
        ok:false,
        msg: `โหมดวิจัย (run=research) ต้องกรอกข้อมูลให้ครบก่อนเริ่มเกม\n${missing.join('\n')}\n\nTip: กรอกในกล่อง Student Profile แล้วกด Save Profile`
      };
    }
    return { ok:true, msg:'' };
  }

  function applyGate(){
    const r = validateForResearch();
    if (!r.ok){
      setBlocked(true);
      showGuard(r.msg);
    } else {
      setBlocked(false);
      hideGuard();
    }
  }

  // init
  function boot(){
    ensureExtraButtons();
    applyGate();
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // ถ้ามีการเปลี่ยนค่า profile ในหน้าเดียวกัน (บางที profile-ui save แล้ว reload อยู่แล้ว)
  WIN.addEventListener('hha:profile:updated', ()=>{ applyGate(); });

})();