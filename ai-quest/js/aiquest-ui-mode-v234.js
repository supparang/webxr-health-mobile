/*
  CSAI2102 AI Quest
  PATCH v2.3.4 Student Mode Clean UI
  ------------------------------------------------------------
  Default: Student Mode
  Teacher tools are hidden unless URL has ?teacher=1 or ?mode=teacher or ?dev=1
*/
(function(){
  'use strict';

  const VERSION = 'v2.3.4-student-mode-clean-ui';

  function qs(){
    return new URLSearchParams(location.search);
  }

  function isTeacherMode(){
    const p = qs();
    return (
      p.get('teacher') === '1' ||
      p.get('admin') === '1' ||
      p.get('dev') === '1' ||
      p.get('mode') === 'teacher' ||
      p.get('view') === 'teacher'
    );
  }

  function $(selector){
    return document.querySelector(selector);
  }

  function $all(selector){
    return Array.from(document.querySelectorAll(selector));
  }

  function hide(selector){
    $all(selector).forEach(node => node.classList.add('teacherOnlyHidden'));
  }

  function show(selector){
    $all(selector).forEach(node => node.classList.remove('teacherOnlyHidden'));
  }

  function injectStyle(){
    if(document.getElementById('aiquestUiModeStyle')) return;

    const style = document.createElement('style');
    style.id = 'aiquestUiModeStyle';
    style.textContent = `
      .teacherOnlyHidden{
        display:none !important;
      }

      body.student-mode .app{
        max-width:980px;
      }

      body.student-mode .topbar{
        top:0;
      }

      body.student-mode .topActions{
        gap:8px;
      }

      body.student-mode .topActions .select{
        min-width:120px;
      }

      body.student-mode .hero{
        grid-template-columns:1fr !important;
      }

      body.student-mode .hero > .panel:nth-child(2){
        display:none !important;
      }

      body.student-mode #profilePanel{
        margin-top:14px !important;
      }

      body.student-mode #profilePanel h2::before{
        content:'1. ';
      }

      body.student-mode #studentStartPanel h2::before{
        content:'2. ';
      }

      body.student-mode #studentProgressPanel h2::before{
        content:'3. ';
      }

      body.student-mode .studentStartActions .btn{
        min-width:180px;
      }

      .studentNotice{
        margin-top:10px;
        padding:12px 14px;
        border-radius:16px;
        background:rgba(56,189,248,.08);
        border:1px solid rgba(56,189,248,.26);
        color:#dbeafe;
        line-height:1.6;
      }

      .studentStepGrid{
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:10px;
        margin-top:12px;
      }

      .studentStep{
        padding:13px;
        border-radius:18px;
        border:1px solid var(--line);
        background:rgba(255,255,255,.06);
      }

      .studentStep b{
        color:#bae6fd;
      }

      .studentModeBadge{
        display:inline-flex;
        align-items:center;
        gap:6px;
        border:1px solid rgba(52,211,153,.28);
        background:rgba(52,211,153,.10);
        color:#bbf7d0;
        font-weight:1000;
        border-radius:999px;
        padding:8px 10px;
        font-size:12px;
      }

      .teacherModeBadge{
        display:inline-flex;
        align-items:center;
        gap:6px;
        border:1px solid rgba(251,191,36,.34);
        background:rgba(251,191,36,.12);
        color:#fde68a;
        font-weight:1000;
        border-radius:999px;
        padding:8px 10px;
        font-size:12px;
      }

      body.student-mode #syncStatusBox{
        display:none !important;
      }

      body.student-mode #btnExportSummary{
        display:none !important;
      }

      @media(max-width:780px){
        .studentStepGrid{
          grid-template-columns:1fr;
        }

        .studentStartActions .btn{
          width:100%;
        }

        body.student-mode .topActions{
          width:100%;
        }

        body.student-mode .topActions > *{
          flex:1 1 auto;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureStudentStartPanel(){
    if($('#studentStartPanel')) return;

    const profilePanel = $('#profilePanel');
    if(!profilePanel || !profilePanel.parentNode) return;

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = 'studentStartPanel';
    panel.style.marginTop = '16px';

    panel.innerHTML = `
      <h2>เริ่มเล่น Session 1</h2>
      <p>
        หัวข้อ <b>AI Awakening</b> ฝึกแยก AI / Automation / Rule-based / Sensor / Prediction
        แล้วส่งผลเข้า Google Sheets หลังกรอก Reflection ครบ
      </p>

      <div class="studentNotice">
        <b>วิธีเล่น:</b> กรอก Student Profile → กดเริ่มเล่น → เล่นจนจบ → กรอก Reflection 3 ข้อ → กดส่งผลเข้า Google Sheets
      </div>

      <div class="studentStepGrid">
        <div class="studentStep">
          <b>เป้าหมาย</b><br>
          เข้าใจว่าอะไรคือ AI และอะไรยังไม่ใช่ AI
        </div>
        <div class="studentStep">
          <b>ผ่านด่าน</b><br>
          ทำคะแนน ≥ 60 หรือทำ Remedial/Reflection ครบ
        </div>
        <div class="studentStep">
          <b>ส่งผล</b><br>
          Reflection ครบแล้วกดส่งเข้า Google Sheets
        </div>
      </div>

      <div class="row studentStartActions" style="margin-top:16px">
        <button class="btn good" id="studentStartGraded">เริ่มเล่นรอบจริง</button>
        <button class="btn secondary" id="studentStartPractice">ฝึกก่อนเล่นจริง</button>
        <button class="btn secondary" id="studentCheckStatus">ดูสถานะของฉัน</button>
      </div>
    `;

    profilePanel.insertAdjacentElement('afterend', panel);

    const startGraded = $('#studentStartGraded');
    const startPractice = $('#studentStartPractice');
    const checkStatus = $('#studentCheckStatus');

    if(startGraded){
      startGraded.onclick = function(){
        if(window.AIQuestGameplayLockdown){
          AIQuestGameplayLockdown.setRunMode('graded');
        }
        startMissionSafe('m1');
      };
    }

    if(startPractice){
      startPractice.onclick = function(){
        if(window.AIQuestGameplayLockdown){
          AIQuestGameplayLockdown.setRunMode('practice');
        }
        startMissionSafe('m1');
      };
    }

    if(checkStatus){
      checkStatus.onclick = function(){
        refreshStudentProgressPanel(true);
      };
    }
  }

  function ensureStudentProgressPanel(){
    if($('#studentProgressPanel')) return;

    const startPanel = $('#studentStartPanel') || $('#profilePanel');
    if(!startPanel || !startPanel.parentNode) return;

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = 'studentProgressPanel';
    panel.style.marginTop = '16px';
    panel.innerHTML = `
      <h2>สถานะของฉัน</h2>
      <div id="studentProgressBox" class="studentNotice">ยังไม่มีข้อมูลสถานะ</div>
    `;

    startPanel.insertAdjacentElement('afterend', panel);
    refreshStudentProgressPanel(false);
  }

  function refreshStudentProgressPanel(showToastFlag){
    const box = $('#studentProgressBox');
    if(!box) return;

    let profile = {};
    try{
      profile = window.AIQuestStorage ? AIQuestStorage.getProfile() : {};
    }catch(error){}

    let score = '-';
    let stars = 0;
    let mastered = false;
    let next = 'เริ่มเล่น Session 1';

    try{
      const rawState = localStorage.getItem('CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS');
      const state = rawState ? JSON.parse(rawState) : {};
      score = state.bestScore && state.bestScore.m1 ? state.bestScore.m1 : '-';
      stars = state.stars && state.stars.m1 ? state.stars.m1 : 0;
      mastered = !!(state.mastered && state.mastered.m1);

      if(score !== '-' && Number(score) >= 60){
        next = mastered ? 'Mastery แล้ว ไป Challenge/Session ถัดไปได้' : 'ผ่านแล้ว เล่นซ้ำเพื่อ Mastery ได้';
      }else if(score !== '-'){
        next = 'ยังควรฝึกเพิ่มหรือทำ Remedial Quest';
      }
    }catch(error){}

    box.innerHTML = `
      <b>Student:</b> ${escapeHtml(profile.studentId || '-')} • ${escapeHtml(profile.studentName || '-')} • ${escapeHtml(profile.section || '-')}<br>
      <b>Session 1:</b> Best Score ${escapeHtml(score)} • ${Number(stars || 0)} ดาว • ${mastered ? 'Mastery' : 'ยังไม่ Mastery'}<br>
      <b>คำแนะนำ:</b> ${escapeHtml(next)}
    `;

    if(showToastFlag && window.showToast){
      showToast('อัปเดตสถานะแล้ว');
    }
  }

  function startMissionSafe(id){
    if(typeof window.startMission === 'function'){
      window.startMission(id);
      return;
    }

    if(typeof startMission === 'function'){
      startMission(id);
      return;
    }

    const hiddenStart = $('#startSelected');
    if(hiddenStart){
      hiddenStart.click();
      return;
    }

    alert('ยังไม่พบฟังก์ชันเริ่มเกม กรุณา refresh หน้าอีกครั้ง');
  }

  function applyStudentMode(){
    document.body.classList.add('student-mode');
    document.body.classList.remove('teacher-mode');

    ensureStudentModeBadge();
    ensureStudentStartPanel();
    ensureStudentProgressPanel();

    hide('#btnResults');
    hide('a[href="./teacher-dashboard.html"]');
    hide('a[href="./classroom-config.html"]');
    hide('a[href="./session2-agent-preview.html"]');
    hide('#btnMenu');
    hide('#btnPracticeMode');
    hide('#btnGateInfo');
    hide('#btnReset');
    hide('#btnTestCloud');

    hide('#gateSupportPanel');
    hide('#adaptiveCoachPanel');
    hide('#classroomEntryPanel');
    hide('#runModePanel');
    hide('#missionMap');
    hide('#detailPanel');
    hide('.layout');
    hide('#syncStatusBox');

    // keep profile, start panel, progress panel, game, result
  }

  function applyTeacherMode(){
    document.body.classList.add('teacher-mode');
    document.body.classList.remove('student-mode');

    ensureTeacherModeBadge();

    show('#btnResults');
    show('a[href="./teacher-dashboard.html"]');
    show('a[href="./classroom-config.html"]');
    show('a[href="./session2-agent-preview.html"]');
    show('#btnMenu');
    show('#btnPracticeMode');
    show('#btnGateInfo');
    show('#btnReset');
    show('#btnTestCloud');
    show('#gateSupportPanel');
    show('#adaptiveCoachPanel');
    show('#classroomEntryPanel');
    show('#runModePanel');
    show('#missionMap');
    show('#detailPanel');
    show('.layout');
    show('#syncStatusBox');

    const startPanel = $('#studentStartPanel');
    const progressPanel = $('#studentProgressPanel');

    if(startPanel) startPanel.remove();
    if(progressPanel) progressPanel.remove();
  }

  function ensureStudentModeBadge(){
    const actions = $('.topActions');
    if(!actions) return;

    let badge = $('#studentModeBadge');
    if(!badge){
      badge = document.createElement('span');
      badge.id = 'studentModeBadge';
      badge.className = 'studentModeBadge';
      badge.textContent = 'Student Mode';
      actions.prepend(badge);
    }

    const teacherBadge = $('#teacherModeBadge');
    if(teacherBadge) teacherBadge.remove();
  }

  function ensureTeacherModeBadge(){
    const actions = $('.topActions');
    if(!actions) return;

    let badge = $('#teacherModeBadge');
    if(!badge){
      badge = document.createElement('span');
      badge.id = 'teacherModeBadge';
      badge.className = 'teacherModeBadge';
      badge.textContent = 'Teacher Mode';
      actions.prepend(badge);
    }

    const studentBadge = $('#studentModeBadge');
    if(studentBadge) studentBadge.remove();
  }

  function applyMode(){
    injectStyle();

    if(isTeacherMode()){
      applyTeacherMode();
    }else{
      applyStudentMode();
    }
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'
    }[c]));
  }

  function boot(){
    applyMode();

    // Some panels are injected by other patches after DOMContentLoaded.
    // Re-apply a few times to keep Student Mode clean.
    setTimeout(applyMode, 50);
    setTimeout(applyMode, 300);
    setTimeout(applyMode, 900);

    const obs = new MutationObserver(function(){
      if(document.body.classList.contains('student-mode')){
        hide('#classroomEntryPanel');
        hide('#runModePanel');
        hide('#syncStatusBox');
      }
    });

    obs.observe(document.body, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  window.AIQuestUIMode = {
    VERSION,
    isTeacherMode,
    applyMode,
    applyStudentMode,
    applyTeacherMode,
    refreshStudentProgressPanel
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
