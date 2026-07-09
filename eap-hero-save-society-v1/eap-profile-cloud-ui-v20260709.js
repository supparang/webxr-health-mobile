/* =========================================================
   EAP Hero Profile Cloud UI v20260709
   V2 BUTTON-FIX / NO RERENDER LOOP
   - Replaces the old full Profile page with Cloud/Sheet profile setup.
   - Identity remains studentId + section. Name is display only.
   - Fixes the previous V1 issue where the MutationObserver kept re-rendering
     the Profile page while it was already displayed, making buttons feel dead.
   - Saving always writes profile keys directly first, then optionally calls
     EAPPlayerProfile.save, then triggers Cloud Resume sync and returns Home.
   - UI-only. Does not change scores, pass/fail, Sheet rows, evidence,
     teacher review, or unlock rules.
========================================================= */
(function(){
  'use strict';

  var VERSION = 'v20260709-EAP-PROFILE-CLOUD-UI-V2-BUTTON-FIX';
  var STATE_KEY = 'EAP_HERO_PROGRESS_V3';
  var PROFILE_KEY = 'EAP_HERO_PLAYER_PROFILE_V1';
  var ACTIVE_KEY = 'EAP_HERO_ACTIVE_PLAYER_V1';
  var STYLE_ID = 'eap-profile-cloud-ui-style-v2';
  var PAGE_ID = 'eap-profile-cloud-ui-page';
  var timer = null;
  var isRendering = false;

  function clean(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]; }); }
  function read(key,fallback){ try{ var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(e){ return fallback; } }
  function write(key,value){ try{ localStorage.setItem(key, JSON.stringify(value)); return true; }catch(e){ return false; } }
  function app(){ return document.getElementById('app') || document.body; }

  function profile(){
    var direct = read(PROFILE_KEY, {});
    var state = read(STATE_KEY, {});
    var merged = Object.assign({}, state.profile || {}, state.player || {}, state.user || {}, direct || {});
    return {
      studentName: clean(merged.studentName || merged.name || state.studentName || state.playerName || 'Student'),
      studentId: clean(merged.studentId || merged.id || state.studentId || ''),
      section: clean(merged.section || state.section || '122') || '122',
      academicGoal: clean(state.academicGoal || direct.academicGoal || 'My academic goal is to improve academic English step by step.')
    };
  }

  function valid(p){ return !!(p && p.studentId && p.studentName && p.section); }

  function isOldProfilePage(){
    var root = app();
    var text = clean(root && root.innerText || '');
    return /Academic\s+Hero\s+Profile/i.test(text) && (/localStorage/i.test(text) || /prototype/i.test(text) || /Go\s+to\s+Campus\s+Map/i.test(text));
  }

  function isOurPage(){ return !!document.getElementById(PAGE_ID); }

  function addStyle(){
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PAGE_ID}{
        position:relative;z-index:1000;pointer-events:auto!important;
        width:min(860px,calc(100vw - 28px));
        margin:24px auto;
        padding:24px;
        border-radius:24px;
        background:#ffffff;
        color:#102033;
        font-family:Arial,'Noto Sans Thai',sans-serif;
        box-shadow:0 18px 50px rgba(8,25,45,.22);
      }
      #${PAGE_ID} *{box-sizing:border-box;pointer-events:auto!important}
      #${PAGE_ID} h1{margin:0 0 8px;font-size:clamp(30px,4vw,46px);line-height:1.05;font-weight:950}
      #${PAGE_ID} .sub{margin:0 0 18px;color:#526071;font-weight:750;line-height:1.45}
      #${PAGE_ID} .grid{display:grid;grid-template-columns:1fr 1fr 150px;gap:12px;align-items:end}
      #${PAGE_ID} label{display:block;font-weight:900;margin:0 0 6px;color:#17375e}
      #${PAGE_ID} input,#${PAGE_ID} textarea{width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:13px 14px;font:800 15px Arial,'Noto Sans Thai',sans-serif;color:#102033;background:#fff}
      #${PAGE_ID} textarea{min-height:96px;resize:vertical;line-height:1.5}
      #${PAGE_ID} .goal{margin-top:13px}
      #${PAGE_ID} .actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}
      #${PAGE_ID} button{border:0;border-radius:16px;padding:13px 16px;font-weight:950;cursor:pointer;min-height:48px;font-size:15px;touch-action:manipulation}
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

  function writeProfileDirect(p){
    var aliased = { id:p.studentId, name:p.studentName, studentId:p.studentId, studentName:p.studentName, section:p.section, academicGoal:p.academicGoal };
    write(PROFILE_KEY, aliased);
    write(ACTIVE_KEY, aliased);
    var state = read(STATE_KEY, {});
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
    state.cloudResumeStatus = 'pending';
    state.profileSavedAt = new Date().toISOString();
    write(STATE_KEY, state);
    return aliased;
  }

  function saveProfile(p){
    var aliased = writeProfileDirect(p);
    try {
      if (window.EAPPlayerProfile && typeof window.EAPPlayerProfile.save === 'function') {
        window.EAPPlayerProfile.save(aliased);
      }
    } catch(e) {}
    try{ window.dispatchEvent(new CustomEvent('eap:profile-saved',{detail:aliased})); }catch(e){}
    try{ window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(read(STATE_KEY,{})),storageArea:localStorage})); }catch(e){}
    return true;
  }

  function goHome(){
    try {
      if (window.EAPHero && typeof window.EAPHero.home === 'function') return window.EAPHero.home();
    } catch(e) {}
    location.href = location.pathname + '?v=profile-cloud-ui-home-' + Date.now();
  }

  function syncCloud(){
    try {
      if (window.EAPPlayerResume && typeof window.EAPPlayerResume.sync === 'function') {
        window.EAPPlayerResume.sync({silent:false, reason:'profile_save'});
      }
    } catch(e) {}
  }

  function values(){
    return {
      studentName: clean((document.getElementById('eap-cloud-profile-name') || {}).value),
      studentId: clean((document.getElementById('eap-cloud-profile-id') || {}).value),
      section: clean(((document.getElementById('eap-cloud-profile-section') || {}).value || '122')) || '122',
      academicGoal: clean((document.getElementById('eap-cloud-profile-goal') || {}).value)
    };
  }

  function handleAction(action, event){
    if (event) {
      try { event.preventDefault(); event.stopPropagation(); } catch(e) {}
    }
    if (!isOurPage()) return false;

    if (action === 'home') { goHome(); return true; }

    if (action === 'clear') {
      try{ localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(ACTIVE_KEY); }catch(err){}
      render(true);
      return true;
    }

    var msg = document.getElementById('eap-cloud-profile-msg');
    var p = values();
    if (!valid(p)) {
      if (msg) msg.textContent = 'กรุณากรอกชื่อผู้เรียน Student ID และ Section ให้ครบ';
      return true;
    }

    saveProfile(p);
    if (msg) {
      msg.style.color = '#047857';
      msg.textContent = 'บันทึกแล้ว กำลังดึงความคืบหน้าจาก Cloud/Sheet…';
    }
    syncCloud();
    setTimeout(goHome, 900);
    return true;
  }

  function bindButtons(){
    var page = document.getElementById(PAGE_ID);
    if (!page) return;
    Array.prototype.forEach.call(page.querySelectorAll('[data-eap-cloud-profile]'), function(btn){
      if (btn.__eapCloudProfileBound) return;
      btn.__eapCloudProfileBound = true;
      var action = btn.getAttribute('data-eap-cloud-profile');
      btn.addEventListener('click', function(e){ handleAction(action, e); }, true);
      btn.addEventListener('touchend', function(e){ handleAction(action, e); }, true);
    });
  }

  function render(force){
    if (isRendering) return;
    if (!force && isOurPage()) { bindButtons(); return; }
    isRendering = true;
    addStyle();
    var p = profile();
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
    isRendering = false;
    bindButtons();
  }

  function onClick(e){
    var btn = e.target && e.target.closest && e.target.closest('[data-eap-cloud-profile]');
    if (!btn) return;
    handleAction(btn.getAttribute('data-eap-cloud-profile'), e);
  }

  function schedule(){
    clearTimeout(timer);
    timer = setTimeout(function(){
      if (isOurPage()) { bindButtons(); return; }
      if (isOldProfilePage()) render(false);
    }, 120);
  }

  function start(){
    addStyle();
    document.addEventListener('click', onClick, true);
    document.addEventListener('touchend', onClick, true);
    window.addEventListener('load', schedule);
    new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
    schedule();
  }

  window.EAPProfileCloudUI = { version: VERSION, refresh: function(){ render(true); }, save: function(){ return handleAction('save'); }, home: goHome };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();