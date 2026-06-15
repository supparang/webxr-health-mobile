/*
  CSAI2102 AI Quest
  PATCH v3.4.1 Student Mode Session 2 Feedback
  ------------------------------------------------------------
  Default: Student Mode
  Teacher tools are hidden unless URL has ?teacher=1 or ?mode=teacher or ?dev=1
*/
(function(){
  'use strict';

  const VERSION = 'v3.4.1-student-mode-session5-astar';

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
      <h2>เริ่มเล่น AI Quest</h2>
      <p>
        <b>Session 1–5 + Boss B2</b> เปิดตาม progress: AI Awakening → Agent Builder → Boss B1 → Search Maze → Route Cost
      </p>

      <div class="studentNotice">
        <b>วิธีเล่น:</b> กรอก Student Profile → เลือก Session → เล่นจนจบ → กรอก Reflection 3 ข้อ → กดส่งผลเข้า Google Sheets
      </div>

      <div class="studentStepGrid">
        <div class="studentStep">
          <b>Session 1</b><br>
          AI / Automation / Sensor / Prediction
        </div>
        <div class="studentStep">
          <b>S2/B1</b><br>
          Agent / PEAS / Rookie Boss
        </div>
        <div class="studentStep">
          <b>S3/S4</b><br>
          Search Maze / Route Cost / A*
        </div>
      </div>

      <div class="row studentStartActions" style="margin-top:16px">
        <button class="btn good" id="studentStartGraded">เริ่ม Session 1</button>
        <button class="btn good" id="studentStartSession2">ไปด่านถัดไป</button>
        <button class="btn secondary" id="studentStartPractice">ฝึก Session 1 ก่อน</button>
        <button class="btn secondary" id="studentCheckStatus">ดูสถานะของฉัน</button>
      </div>
    `;

    profilePanel.insertAdjacentElement('afterend', panel);

    const startGraded = $('#studentStartGraded');
    const startSession2 = $('#studentStartSession2');
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

    if(startSession2){
      startSession2.onclick = function(){
        if(window.AIQuestGameplayLockdown){
          AIQuestGameplayLockdown.setRunMode('graded');
        }

        const topBtn = $('#btnSession2Top');
        if(topBtn){
          topBtn.click();
          return;
        }

        startMissionSafe('m2');
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

  function getAiQuestState(){
    try{
      const rawState = localStorage.getItem('CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS');
      return rawState ? JSON.parse(rawState) : {};
    }catch(error){
      return {};
    }
  }

  function sessionInfo(state, id){
    const bestScore = state.bestScore && state.bestScore[id] ? Number(state.bestScore[id]) : null;
    const stars = state.stars && state.stars[id] ? Number(state.stars[id]) : 0;
    const mastered = !!(state.mastered && state.mastered[id]);
    const completed = !!(state.completed && state.completed[id]);
    const bestTime = state.bestTime && state.bestTime[id] ? state.bestTime[id] : '';
    const reflection = state.reflections && state.reflections[id] ? state.reflections[id] : {};
    const reflectionText = [reflection.ref1, reflection.ref2, reflection.ref3].map(v => String(v || '').trim());
    const reflectionComplete = reflectionText.every(Boolean);
    const reflectionShort = reflectionComplete && reflectionText.some(v => v.length < 20);

    let status = 'ยังไม่เริ่ม';
    let cls = 'warn';
    let next = id === 'm1'
      ? 'เริ่มเล่น Session 1'
      : id === 'm2'
        ? 'เริ่มเล่น Session 2 หลังผ่าน Session 1'
        : id === 'b1'
          ? 'เล่น Boss B1 หลังผ่าน Session 1–2'
          : id === 'm3'
            ? 'เริ่มเล่น Session 3 หลังผ่าน Boss B1'
            : id === 'm4'
              ? 'เริ่มเล่น Session 4 หลังผ่าน Session 3'
              : id === 'm5'
                ? 'เริ่มเล่น Session 5 หลังผ่าน Session 4'
                : 'เริ่มเล่นด่านถัดไป';

    if(bestScore != null){
      if(mastered){
        status = 'Mastery';
        cls = 'good';
        next = id === 'm1'
          ? 'พร้อมไป Session 2 / Challenge'
          : id === 'm2'
            ? 'พร้อมต่อยอด Session 3'
            : id === 'b1'
              ? 'พร้อมต่อยอด Session 3 Search Maze'
              : id === 'm3'
                ? 'พร้อมไป Session 4 Route Cost หรือเล่นซ้ำเพื่อความแม่นยำ'
                : id === 'm4'
                  ? 'พร้อมไป Session 5 A* หรือเล่นซ้ำเพื่อ Mastery'
                  : id === 'm5'
                    ? 'พร้อมไป Boss B2 เมื่อเปิด หรือเล่นซ้ำเพื่อ Mastery'
                    : 'พร้อมต่อยอดด่านถัดไป';
      }else if(bestScore >= 70){
        status = 'ผ่านดี';
        cls = 'good';
        next = 'ผ่านแล้ว เล่นซ้ำเพื่อ Mastery ได้';
      }else if(bestScore >= 60){
        status = 'ผ่านขั้นต่ำ';
        cls = 'warn';
        next = 'ควรฝึกเพิ่มเพื่อความมั่นใจก่อน Challenge';
      }else{
        status = 'ควรทบทวน';
        cls = 'bad';
        next = 'ทำ Practice/Remedial เพิ่ม';
      }
    }

    if(bestScore != null && reflectionShort){
      next += ' และควรเขียน Reflection ให้ยาวขึ้น';
      if(cls === 'good') cls = 'warn';
    }

    return {
      id,
      bestScore,
      stars,
      mastered,
      completed,
      bestTime,
      reflectionComplete,
      reflectionShort,
      status,
      cls,
      next
    };
  }

  function sessionCardHTML(title, info){
    const scoreText = info.bestScore == null ? '-' : info.bestScore;
    const masteryText = info.mastered ? 'Mastery' : 'ยังไม่ Mastery';
    const refText = !info.reflectionComplete ? 'Reflection ยังไม่ครบ' : info.reflectionShort ? 'Reflection สั้น' : 'Reflection OK';
    const timeText = info.bestTime ? ` • Best Time ${escapeHtml(info.bestTime)}s` : '';

    return `
      <div class="studentSessionCard ${info.cls}">
        <h3>${escapeHtml(title)}</h3>
        <div><b>Best Score:</b> ${escapeHtml(scoreText)} • <b>ดาว:</b> ${Number(info.stars || 0)} • ${escapeHtml(masteryText)}${timeText}</div>
        <div class="studentSessionMeta">${escapeHtml(refText)}</div>
        <ul class="studentFeedbackList">
          <li><b>สถานะ:</b> ${escapeHtml(info.status)}</li>
          <li><b>Feedback:</b> ${escapeHtml(info.next)}</li>
        </ul>
      </div>
    `;
  }

  function refreshStudentProgressPanel(showToastFlag){
    const box = $('#studentProgressBox');
    if(!box) return;

    let profile = {};
    try{
      profile = window.AIQuestStorage ? AIQuestStorage.getProfile() : {};
    }catch(error){}

    const state = getAiQuestState();
    const s1 = sessionInfo(state, 'm1');
    const s2 = sessionInfo(state, 'm2');
    const b1 = sessionInfo(state, 'b1');
    const s3 = sessionInfo(state, 'm3');
    const s4 = sessionInfo(state, 'm4');
    const s5 = sessionInfo(state, 'm5');
    const b2 = sessionInfo(state, 'b2');

    const completed = Object.keys(state.completed || {}).length;
    const stars = Object.values(state.stars || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    const badges = Array.isArray(state.badges) ? state.badges.length : 0;

    let overall = 'เริ่มจาก Session 1';
    if(s1.bestScore != null && s2.bestScore == null) overall = 'ผ่าน Session 1 แล้ว สามารถเล่น Session 2 ได้';
    if(s2.bestScore != null && b1.bestScore == null) overall = 'ผ่าน Session 1–2 แล้ว Boss Gate B1 เปิดแล้ว';
    if(b1.bestScore != null && s3.bestScore == null){
      overall = b1.mastered ? 'Rookie Boss Mastery แล้ว พร้อมต่อยอดกลุ่ม Search' : 'เล่น Rookie Boss แล้ว ดู feedback และเล่นซ้ำเพื่อ Mastery ได้';
    }
    if(s3.bestScore != null && s4.bestScore == null){
      overall = s3.mastered
        ? 'ผ่าน Session 3 แบบ Mastery แล้ว พร้อมต่อยอด Session 4 Route Cost'
        : s3.bestScore >= 70
          ? 'ผ่าน Session 3 แล้ว สามารถเล่นซ้ำเพื่อ Mastery หรือเริ่ม Session 4 ได้'
          : 'จบ Session 3 แล้ว แต่ควรทบทวน Search เพิ่มก่อนขึ้นด่านถัดไป';
    }

    if(s4.bestScore != null && s5.bestScore == null){
      overall = s4.mastered
        ? 'ผ่าน Session 4 แบบ Mastery แล้ว พร้อมต่อยอด Session 5 A*'
        : s4.bestScore >= 70
          ? 'ผ่าน Session 4 แล้ว สามารถเล่นซ้ำเพื่อ Mastery หรือเริ่ม Session 5 ได้'
          : 'จบ Session 4 แล้ว แต่ควรทบทวน UCS / route cost เพิ่มก่อนขึ้นด่านถัดไป';
    }

    if(s5.bestScore != null && b2.bestScore == null){
      overall = s5.mastered
        ? 'ผ่าน Session 5 แบบ Mastery แล้ว พร้อมต่อยอด Boss B2'
        : s5.bestScore >= 70
          ? 'ผ่าน Session 5 แล้ว สามารถเล่นซ้ำเพื่อ Mastery หรือเริ่ม Boss B2 ได้'
          : 'จบ Session 5 แล้ว แต่ควรทบทวน A* / heuristic เพิ่มก่อนขึ้น Boss B2';
    }

    if(b2.bestScore != null){
      overall = b2.mastered
        ? 'ผ่าน Boss B2 แบบ Mastery แล้ว พร้อมต่อยอด S6 เมื่อเปิด'
        : b2.bestScore >= 70
          ? 'ผ่าน Boss B2 แล้ว สามารถเล่นซ้ำเพื่อ Mastery หรือรอ S6 ได้'
          : 'จบ Boss B2 แล้ว แต่ควรทบทวน Search Arena เพิ่มก่อนขึ้น S6';
    }

    box.innerHTML = `
      <b>Student:</b> ${escapeHtml(profile.studentId || '-')} • ${escapeHtml(profile.studentName || '-')} • ${escapeHtml(profile.section || '-')}<br>
      <b>ภาพรวม:</b> Completed ${Number(completed || 0)} • Stars ${Number(stars || 0)} • Badges ${Number(badges || 0)}<br>
      <b>คำแนะนำรวม:</b> ${escapeHtml(overall)}
      <div class="studentSessionStatusGrid">
        ${sessionCardHTML('Session 1: AI Awakening', s1)}
        ${sessionCardHTML('Session 2: Agent Builder', s2)}
        ${sessionCardHTML('Boss B1: Rookie AI Boss', b1)}
        ${sessionCardHTML('Session 3: Search Maze', s3)}
        ${sessionCardHTML('Session 4: Route Cost Challenge', s4)}
        ${sessionCardHTML('Session 5: A* Rescue Mission', s5)}
        ${sessionCardHTML('Boss B2: Search Arena Boss', b2)}
      </div>
    `;

    if(showToastFlag && window.showToast){
      showToast('อัปเดตสถานะ Session 1 / Session 2 / Boss B1 / Session 3 / Session 4 แล้ว');
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
