/*
  CSAI2102 AI Quest
  PATCH v2.1c Classroom Entry + System Check
  ------------------------------------------------------------
  ทำหน้าที่กันพลาดก่อนเข้าสู่ v2.2/v2.3:
  - Classroom Entry Gate
  - System Check
  - Draft / Resume Notice
  - Submit Policy Notice
  - Teacher Override placeholder
*/
(function(){
  'use strict';

  const VERSION = 'v2.1c-classroom-entry-system-check';
  const STORE_KEY = 'CSAI2102_AIQUEST_CLASSROOM_ENTRY_V21C';
  const DEFAULT_CLASS = {
    courseId:'CSAI2102',
    courseName:'Artificial Intelligence Principles',
    term:'1/2569',
    classId:'CSAI2102-2569-SEC01',
    section:'SEC01',
    teacherId:'supparang',
    sessionId:'s1',
    mode:'graded'
  };

  function nowIso(){ return new Date().toISOString(); }

  function qs(){
    return new URLSearchParams(location.search);
  }

  function load(){
    try{
      return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
    }catch(error){
      return defaultState();
    }
  }

  function defaultState(){
    return {
      version:VERSION,
      classroom:Object.assign({}, DEFAULT_CLASS),
      entryConfirmed:false,
      entryConfirmedAt:'',
      systemCheck:null,
      draftAttempt:null,
      submitPolicyAccepted:false,
      override:null,
      updatedAt:nowIso()
    };
  }

  function save(state){
    state.updatedAt = nowIso();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function getClassroom(){
    const state = load();
    const p = qs();
    const c = Object.assign({}, state.classroom || DEFAULT_CLASS);

    ['courseId','term','classId','section','teacherId','sessionId','mode'].forEach(k => {
      if(p.get(k)) c[k] = p.get(k);
    });

    return c;
  }

  function setClassroom(data){
    const state = load();
    state.classroom = Object.assign({}, state.classroom || DEFAULT_CLASS, data || {});
    state.entryConfirmed = false;
    save(state);
    return state.classroom;
  }

  function confirmEntry(){
    const state = load();
    state.classroom = getClassroom();
    state.entryConfirmed = true;
    state.entryConfirmedAt = nowIso();
    save(state);
    return state;
  }

  function resetEntry(){
    const state = load();
    state.entryConfirmed = false;
    state.entryConfirmedAt = '';
    save(state);
  }

  function isEntryConfirmed(){
    return !!load().entryConfirmed;
  }

  async function systemCheck(){
    const checks = [];
    const add = (name, ok, detail) => checks.push({name, ok:!!ok, detail:detail || ''});

    try{
      localStorage.setItem('__aiquest_test__','1');
      localStorage.removeItem('__aiquest_test__');
      add('Storage', true, 'localStorage OK');
    }catch(error){
      add('Storage', false, 'localStorage blocked');
    }

    add('Question Bank S1', typeof window.buildMission1Round === 'function', typeof window.buildMission1Round === 'function' ? 'mission1-bank loaded' : 'mission1-bank missing');
    add('Session 2 Bank', typeof window.buildSession2Round === 'function', typeof window.buildSession2Round === 'function' ? 'session2 bank loaded' : 'session2 bank optional/missing');
    add('Gate Support', !!window.AIQuestGateSupport, window.AIQuestGateSupport ? 'gate engine loaded' : 'gate engine missing');
    add('Gameplay Lockdown', !!window.AIQuestGameplayLockdown, window.AIQuestGameplayLockdown ? 'lockdown loaded' : 'lockdown missing');

    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    add('Screen', width >= 320, width >= 320 ? `screen width ${width}px OK` : `screen too small ${width}px`);

    const online = navigator.onLine !== false;
    add('Network', online, online ? 'browser reports online' : 'browser reports offline');

    let pending = 0;
    try{
      Object.keys(localStorage).forEach(k => {
        if(k.toLowerCase().includes('pending')) pending += 1;
      });
    }catch(error){}
    add('Pending Sync', true, `${pending} pending bucket(s)`);

    if(window.AIQuestCloudLogger && AIQuestCloudLogger.healthCheck){
      try{
        const r = await AIQuestCloudLogger.healthCheck();
        add('Google Sheets Endpoint', !!r.ok, r.ok ? 'endpoint reachable/opaque OK' : (r.reason || r.error || 'not ready'));
      }catch(error){
        add('Google Sheets Endpoint', false, String(error.message || error));
      }
    }else{
      add('Google Sheets Endpoint', false, 'cloud logger not loaded');
    }

    const result = {
      version:VERSION,
      at:nowIso(),
      ok: checks.every(x => x.ok),
      checks
    };

    const state = load();
    state.systemCheck = result;
    save(state);

    return result;
  }

  function createDraftAttempt(meta){
    const state = load();
    state.draftAttempt = Object.assign({
      draftId:'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2,8),
      status:'in_progress',
      createdAt:nowIso(),
      updatedAt:nowIso()
    }, meta || {});
    save(state);
    return state.draftAttempt;
  }

  function clearDraftAttempt(){
    const state = load();
    state.draftAttempt = null;
    save(state);
  }

  function getDraftAttempt(){
    return load().draftAttempt;
  }

  function acceptSubmitPolicy(){
    const state = load();
    state.submitPolicyAccepted = true;
    save(state);
  }

  function isSubmitPolicyAccepted(){
    return !!load().submitPolicyAccepted;
  }

  function applyTeacherOverride(code, reason){
    const state = load();
    const normalized = String(code || '').trim().toUpperCase();
    const allowed = ['UNLOCK-S1','REMEDIAL-OK','OPEN-D2','DEMO-RESET'];
    const ok = allowed.includes(normalized);

    state.override = {
      ok,
      code:normalized,
      reason:reason || '',
      overrideBy:'teacher_local',
      overrideAt:nowIso()
    };

    if(ok && normalized === 'REMEDIAL-OK' && window.AIQuestGateSupport){
      AIQuestGateSupport.markRemedialPassed('m1', 75);
    }

    save(state);
    return state.override;
  }

  function showClassroomGate(onDone){
    injectPanel();
    const modal = ensureModal();
    const c = getClassroom();

    modal.querySelector('#entryCourse').textContent = `${c.courseId} • ${c.courseName || ''}`;
    modal.querySelector('#entryClass').textContent = c.classId || '-';
    modal.querySelector('#entryTerm').textContent = c.term || '-';
    modal.querySelector('#entrySession').textContent = c.sessionId || '-';
    modal.querySelector('#entryMode').textContent = c.mode || '-';

    modal.classList.add('show');

    modal.querySelector('#btnEntryConfirm').onclick = () => {
      const ok = modal.querySelector('#entryAgree').checked;
      if(!ok){
        if(window.showToast) showToast('กรุณาติ๊กยืนยันก่อนเข้าห้องเรียน');
        return;
      }
      confirmEntry();
      modal.classList.remove('show');
      renderEntryPanel();
      if(onDone) onDone();
    };

    modal.querySelector('#btnEntryPractice').onclick = () => {
      setClassroom({mode:'practice'});
      if(window.AIQuestGameplayLockdown) AIQuestGameplayLockdown.setRunMode('practice');
      confirmEntry();
      modal.classList.remove('show');
      renderEntryPanel();
      if(onDone) onDone();
    };

    modal.querySelector('#btnEntryCancel').onclick = () => {
      modal.classList.remove('show');
    };
  }

  function ensureModal(){
    let modal = document.getElementById('classroomEntryBack');
    if(modal) return modal;

    modal = document.createElement('div');
    modal.id = 'classroomEntryBack';
    modal.className = 'modalBack';
    modal.innerHTML = `
      <div class="modal">
        <h3>Classroom Entry Gate</h3>
        <p>ตรวจสอบว่าคุณเข้าห้องเรียนถูกต้องก่อนเริ่มเล่น</p>
        <div class="coachBox">
          <b>Course:</b> <span id="entryCourse"></span><br>
          <b>Class:</b> <span id="entryClass"></span><br>
          <b>Term:</b> <span id="entryTerm"></span><br>
          <b>Session:</b> <span id="entrySession"></span><br>
          <b>Mode:</b> <span id="entryMode"></span>
        </div>
        <label style="display:flex;gap:8px;align-items:flex-start;margin:12px 0">
          <input type="checkbox" id="entryAgree">
          <span>ฉันยืนยันว่าอยู่ห้องนี้จริง ข้อมูลถูกต้อง และรับทราบว่าระบบจะบันทึกข้อมูลเพื่อการเรียนการสอน</span>
        </label>
        <div class="row" style="justify-content:flex-end">
          <button class="btn secondary" id="btnEntryCancel">ยกเลิก</button>
          <button class="btn secondary" id="btnEntryPractice">เข้า Practice</button>
          <button class="btn good" id="btnEntryConfirm">ยืนยันเข้าห้อง</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function injectPanel(){
    if(document.getElementById('classroomEntryPanel')) return;
    const menu = document.getElementById('menuScreen');
    if(!menu) return;

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = 'classroomEntryPanel';
    panel.style.marginTop = '16px';
    panel.innerHTML = `
      <h2>Classroom Entry + System Check</h2>
      <p>ตรวจห้องเรียน เครื่อง และสถานะ sync ก่อนใช้จริงในห้องเรียน</p>
      <div class="row">
        <button class="btn good" id="btnClassroomEntry">Classroom Entry</button>
        <button class="btn secondary" id="btnSystemCheck">System Check</button>
        <button class="btn secondary" id="btnSubmitPolicy">Submit Policy</button>
        <input id="teacherOverrideInput" placeholder="Teacher Override Code" style="min-width:190px;padding:11px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--text)">
        <button class="btn warn" id="btnTeacherOverride">Apply Override</button>
      </div>
      <div id="classroomEntryStatus" style="margin-top:12px"></div>
    `;

    const ref = document.getElementById('runModePanel') || menu.querySelector('.layout');
    if(ref && ref.parentNode === menu){
      menu.insertBefore(panel, ref);
    }else{
      menu.appendChild(panel);
    }

    panel.querySelector('#btnClassroomEntry').onclick = () => showClassroomGate();
    panel.querySelector('#btnSystemCheck').onclick = async () => {
      renderEntryPanel('กำลังตรวจระบบ...');
      const result = await systemCheck();
      renderEntryPanel(result.ok ? 'System Check OK' : 'System Check พบปัญหา');
    };
    panel.querySelector('#btnSubmitPolicy').onclick = () => showSubmitPolicy();
    panel.querySelector('#btnTeacherOverride').onclick = () => {
      const code = panel.querySelector('#teacherOverrideInput').value;
      const r = applyTeacherOverride(code, 'manual local override');
      renderEntryPanel(r.ok ? 'Override applied' : 'Override code ไม่ถูกต้อง');
    };

    renderEntryPanel();
  }

  function showSubmitPolicy(){
    let back = document.getElementById('submitPolicyBack');
    if(!back){
      back = document.createElement('div');
      back.id = 'submitPolicyBack';
      back.className = 'modalBack';
      back.innerHTML = `
        <div class="modal">
          <h3>Submit Policy</h3>
          <p>นโยบายการบันทึกคะแนนใน AI Quest</p>
          <div class="coachBox">
            • ระบบเก็บทุก attempt เพื่อใช้วิเคราะห์การเรียนรู้<br>
            • คะแนนที่ใช้ใน Dashboard = Best Graded Attempt<br>
            • Practice ไม่นับคะแนนหลัก<br>
            • Remedial ใช้เปิด Learning Path<br>
            • เมื่อ Submit แล้ว attempt นั้นแก้คำตอบไม่ได้
          </div>
          <label style="display:flex;gap:8px;align-items:flex-start;margin:12px 0">
            <input type="checkbox" id="submitPolicyAgree">
            <span>ฉันรับทราบนโยบายการบันทึกและการนับคะแนน</span>
          </label>
          <div class="row" style="justify-content:flex-end">
            <button class="btn secondary" id="btnSubmitPolicyClose">ปิด</button>
            <button class="btn good" id="btnSubmitPolicyAccept">รับทราบ</button>
          </div>
        </div>
      `;
      document.body.appendChild(back);
    }
    back.classList.add('show');
    back.querySelector('#btnSubmitPolicyClose').onclick = () => back.classList.remove('show');
    back.querySelector('#btnSubmitPolicyAccept').onclick = () => {
      if(!back.querySelector('#submitPolicyAgree').checked){
        if(window.showToast) showToast('กรุณาติ๊กยืนยันก่อน');
        return;
      }
      acceptSubmitPolicy();
      back.classList.remove('show');
      renderEntryPanel('รับทราบ Submit Policy แล้ว');
    };
  }

  function renderEntryPanel(message){
    const box = document.getElementById('classroomEntryStatus');
    if(!box) return;
    const state = load();
    const c = getClassroom();
    const checks = state.systemCheck?.checks || [];
    box.innerHTML = `
      <div class="coachBox">
        <b>Class:</b> ${escapeHtml(c.classId)} |
        <b>Term:</b> ${escapeHtml(c.term)} |
        <b>Session:</b> ${escapeHtml(c.sessionId)} |
        <b>Mode:</b> ${escapeHtml(c.mode)}<br>
        <b>Entry:</b> ${state.entryConfirmed ? 'Confirmed' : 'Not confirmed'} |
        <b>Policy:</b> ${state.submitPolicyAccepted ? 'Accepted' : 'Not accepted'}
        ${message ? '<br><b>Status:</b> ' + escapeHtml(message) : ''}
      </div>
      ${checks.length ? `
        <div class="coachBox">
          <b>System Check</b><br>
          ${checks.map(x => `${x.ok ? '✅' : '⚠️'} ${escapeHtml(x.name)}: ${escapeHtml(x.detail)}`).join('<br>')}
        </div>
      ` : ''}
      ${state.override ? `
        <div class="coachBox">
          <b>Teacher Override:</b> ${state.override.ok ? 'OK' : 'Failed'} • ${escapeHtml(state.override.code || '')}
        </div>
      ` : ''}
    `;
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function boot(){
    injectPanel();
    const p = qs();
    if(p.get('classId') || p.get('courseId') || p.get('sessionId')){
      setClassroom({
        courseId:p.get('courseId') || getClassroom().courseId,
        classId:p.get('classId') || getClassroom().classId,
        section:p.get('section') || getClassroom().section,
        term:p.get('term') || getClassroom().term,
        sessionId:p.get('sessionId') || p.get('session') || getClassroom().sessionId,
        mode:p.get('mode') || getClassroom().mode
      });
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  window.AIQuestClassroomEntry = {
    VERSION,
    DEFAULT_CLASS,
    load,
    save,
    getClassroom,
    setClassroom,
    confirmEntry,
    resetEntry,
    isEntryConfirmed,
    systemCheck,
    createDraftAttempt,
    clearDraftAttempt,
    getDraftAttempt,
    acceptSubmitPolicy,
    isSubmitPolicyAccepted,
    applyTeacherOverride,
    showClassroomGate,
    showSubmitPolicy,
    renderEntryPanel
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
