/* =========================================================
   EAP Hero Profile Cloud UI v20260709
   V1 REPLACE OLD LOCALSTORAGE PROFILE PAGE
   - The old full Profile page said localStorage/prototype and had no clear
     Section field for moving between lab/mobile/home.
   - This guard replaces only that old Profile page with a Cloud/Sheet resume
     profile screen.
   - Identity remains studentId + section. Name is display only.
   - Saving calls EAPPlayerProfile.save when available, then triggers
     Cloud Resume sync and returns to the student lobby.
   - UI-only. Does not change scores, pass/fail, Sheet rows, evidence,
     teacher review, or unlock rules.
========================================================= */
(function(){
  'use strict';

  const VERSION = 'v20260709-EAP-PROFILE-CLOUD-UI-V1';
  const STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  const PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  const ACTIVE_KEY = 'EAP_HERO_ACTIVE_PLAYER_V1';
  const STYLE_ID = 'eap-profile-cloud-ui-style-v1';
  const PAGE_ID = 'eap-profile-cloud-ui-page';

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function read(key,fallback){ try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(e){ return fallback; } }
  function write(key,value){ try{ localStorage.setItem(key, JSON.stringify(value)); return true; }catch(e){ return false; } }
  function app(){ return document.getElementById('app') || document.body; }

  function profile(){
    const direct = read(PROFILE_KEY, {});
    const state = read(STATE_KEY, {});
    const merged = Object.assign({}, state.profile || {}, state.player || {}, state.user || {}, direct || {});
    return {
      studentName: clean(merged.studentName || merged.name || state.studentName || state.playerName || 'Student'),
      studentId: clean(merged.studentId || merged.id || state.studentId || ''),
      section: clean(merged.section || state.section || '122') || '122',
      academicGoal: clean(state.academicGoal || direct.academicGoal || 'My academic goal is to improve academic English step by step.')
    };
  }

  function valid(p){ return !!(p && p.studentId && p.studentName && p.section); }

  function isOldProfilePage(){
    const root = app();
    const text = clean(root && root.innerText || '');
    if (document.getElementById(PAGE_ID)) return true;
    return /Academic\s+Hero\s+Profile/i.test(text) && (/localStorage/i.test(text) || /prototype/i.test(text) || /Go\s+to\s+Campus\s+Map/i.test(text));
  }

  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PAGE_ID}{
        width:min(860px,calc(100vw - 28px));
        margin:24px auto;
        padding:24px;
        border-radius:24px;
        background:#ffffff;
        color:#102033;
        font-family:Arial,'Noto Sans Thai',sans-serif;
        box-shadow:0 18px 50px rgba(8,25,45,.22);
      }
      #${PAGE_ID} *{box-sizing:border-box}
      #${PAGE_ID} h1{margin:0 0 8px;font-size:clamp(30px,4vw,46px);line-height:1.05;font-weight:950}
      #${PAGE_ID} .sub{margin:0 0 18px;color:#526071;font-weight:750;line-height:1.45}
      #${PAGE_ID} .grid{display:grid;grid-template-columns:1fr 1fr 150px;gap:12px;align-items:end}
      #${PAGE_ID} label{display:block;font-weight:900;margin:0 0 6px;color:#17375e}
      #${PAGE_ID} input,#${PAGE_ID} textarea{width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:13px 14px;font:800 15px Arial,'Noto Sans Thai',sans-serif;color:#102033;background:#fff}
      #${PAGE_ID} textarea{min-height:96px;resize:vertical;line-height:1.5}
      #${PAGE_ID} .goal{margin-top:13px}
      #${PAGE_ID} .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
      #${PAGE_ID} button{border:0;border-radius:16px;padding:13px 16px;font-weight:950;cursor:pointer;min-height:48px;font-size:15px}
      #${PAGE_ID} .primary{background:#8ee9e3;color:#102033;box-shadow:0 10px 24px rgba(45,212,191,.22)}
      #${PAGE_ID} .secondary{background:#e2e8f0;color:#102033}
      #${PAGE_ID} .ghost{background:#fff;color:#17375e;border:1px solid #cbd5e1}
      #${PAGE_ID} .note{margin-top:16px;padding:12px 14px;border-radius:16px;background:#ecfeff;border:1px solid #bae6fd;color:#155e75;font-weight:850;line-height:1.45}
      #${PAGE_ID} .msg{min-height:22px;margin-top:10px;font-weight:900;color:#b42318}
      @media(max-width:760px){
        #${PAGE_ID}{margin:10px 8px;padding:16px;width:calc(100vw - 16px);border-radius:20px}
        #${PAGE_ID} .grid{grid-template-columns:1fr}
        #${PAGE_ID} .actions{display:grid;grid-template-columns:1fr}
        #${PAGE_ID} button{width:100%}
      }
    `;
    document.head.appendChild(style);
  }

  function saveProfile(p){
    const aliased = { id:p.studentId, name:p.studentName, studentId:p.studentId, studentName:p.studentName, section:p.section, academicGoal:p.academicGoal };
    if (window.EAPPlayerProfile && typeof window.EAPPlayerProfile.save === 'function') {
      window.EAPPlayerProfile.save(aliased);
    } else {
      write(PROFILE_KEY, aliased);
      write(ACTIVE_KEY, aliased);
      const state = read(STATE_KEY, {});
      state.profile = Object.assign({}, state.profile || {}, aliased);
      state.player = Object.assign({}, state.player || {}, aliased);
      state.user = Object.assign({}, state.user || {}, aliased);
      state.id = aliased.id;
      state.name = aliased.name;
      state.playerName = aliased.name;
      state.studentId = aliased.studentId;
      state.studentName = aliased.studentName;
      state.section = aliased.section;
      state.academicGoal = p.academicGoal;
      write(STATE_KEY, state);
    }
    try{ window.dispatchEvent(new CustomEvent('eap:profile-saved',{detail:aliased})); }catch(e){}
    try{ window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(read(STATE_KEY,{})),storageArea:localStorage})); }catch(e){}
    return true;
  }

  function goHome(){
    try {
      if (window.EAPHero && typeof window.EAPHero.home === 'function') return window.EAPHero.home();
      if (window.EAPHero && typeof window.EAPHero.map === 'function') return window.EAPHero.map();
    } catch(e) {}
    location.href = location.pathname + '?v=profile-cloud-ui-home-' + Date.now();
  }

  function render(){
    addStyle();
    const p = profile();
    app().innerHTML = `
      <section id="${PAGE_ID}" aria-label="EAP Hero Profile">
        <h1>ตั้งค่าผู้เรียน / ย้ายเครื่อง</h1>
        <p class="sub">ใช้ <b>Student ID + Section</b> เป็นตัวตนหลักเพื่อดึงความคืบหน้าจาก Cloud/Sheet ชื่อใช้แสดงผลเท่านั้น</p>
        <div class="grid">
          <div>
            <label for="eap-cloud-profile-name">ชื่อผู้เรียน</label>
            <input id="eap-cloud-profile-name" value="${esc(p.studentName)}" placeholder="เช่น KAT" autocomplete="name">
          </div>
          <div>
            <label for="eap-cloud-profile-id">Student ID</label>
            <input id="eap-cloud-profile-id" value="${esc(p.studentId)}" placeholder="เช่น 65010001" autocomplete="off" inputmode="numeric">
          </div>
          <div>
            <label for="eap-cloud-profile-section">Section</label>
            <input id="eap-cloud-profile-section" value="${esc(p.section || '122')}" placeholder="122" autocomplete="off">
          </div>
        </div>
        <div class="goal">
          <label for="eap-cloud-profile-goal">Academic Goal</label>
          <textarea id="eap-cloud-profile-goal" placeholder="เขียนเป้าหมายการเรียนสั้น ๆ">${esc(p.academicGoal)}</textarea>
        </div>
        <div class="note">เครื่องใหม่/เครื่อง Lab: ใส่ Student ID และ Section เดิม แล้วกด “บันทึกและดึงความคืบหน้า” ระบบจะเรียก Cloud Resume/Sheet เพื่อคืนด่านล่าสุด</div>
        <div id="eap-cloud-profile-msg" class="msg" aria-live="polite"></div>
        <div class="actions">
          <button type="button" class="primary" data-eap-cloud-profile="save">บันทึกและดึงความคืบหน้า</button>
          <button type="button" class="secondary" data-eap-cloud-profile="home">กลับหน้าแรก</button>
          <button type="button" class="ghost" data-eap-cloud-profile="clear">ล้างเครื่องนี้แล้วกรอกใหม่</button>
        </div>
      </section>
    `;
  }

  function syncCloud(){
    try {
      if (window.EAPPlayerResume && typeof window.EAPPlayerResume.sync === 'function') {
        window.EAPPlayerResume.sync({silent:false});
      }
    } catch(e) {}
  }

  function onClick(e){
    const btn = e.target && e.target.closest && e.target.closest('[data-eap-cloud-profile]');
    if (!btn) return;
    const action = btn.getAttribute('data-eap-cloud-profile');
    if (!document.getElementById(PAGE_ID)) return;
    e.preventDefault();

    if (action === 'home') return goHome();

    if (action === 'clear') {
      try{ localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(ACTIVE_KEY); }catch(err){}
      render();
      return;
    }

    const msg = document.getElementById('eap-cloud-profile-msg');
    const p = {
      studentName: clean(document.getElementById('eap-cloud-profile-name').value),
      studentId: clean(document.getElementById('eap-cloud-profile-id').value),
      section: clean(document.getElementById('eap-cloud-profile-section').value || '122') || '122',
      academicGoal: clean(document.getElementById('eap-cloud-profile-goal').value)
    };

    if (!valid(p)) {
      msg.textContent = 'กรุณากรอกชื่อผู้เรียน Student ID และ Section ให้ครบ';
      return;
    }

    saveProfile(p);
    msg.style.color = '#047857';
    msg.textContent = 'บันทึกแล้ว กำลังดึงความคืบหน้าจาก Cloud/Sheet…';
    syncCloud();
    setTimeout(goHome, 850);
  }

  let timer = null;
  function schedule(){ clearTimeout(timer); timer = setTimeout(function(){ if (isOldProfilePage()) render(); }, 90); }

  function start(){
    addStyle();
    document.addEventListener('click', onClick, true);
    window.addEventListener('load', schedule);
    new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
    schedule();
  }

  window.EAPProfileCloudUI = { version: VERSION, refresh: render };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();