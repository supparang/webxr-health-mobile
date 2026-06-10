/*
  CSAI2102 AI Quest
  PATCH v2.1b Gameplay Lockdown
  ------------------------------------------------------------
  ก่อนทำ v2.2 Data Contract ให้ล็อก flow ในห้องเรียน:
  - Run Mode badge: practice / graded / remedial / challenge / demo
  - Start Confirm สำหรับ Graded Attempt
  - Result status: CLEAR / PROFICIENT / MASTERED / NEEDS REMEDIAL
  - Action buttons ตามสถานะหลังจบ
  - Wrong Review grouped by misconception
  - AI Help 3 levels schema
  - Save Result lock กันกดซ้ำ
*/
(function(){
  'use strict';

  const VERSION = 'v2.1b-gameplay-lockdown-submit-flow-fix';
  const STORE_KEY = 'CSAI2102_AIQUEST_GAMEPLAY_LOCKDOWN_V21B';

  const RUN_MODES = {
    practice:{
      label:'PRACTICE',
      title:'Practice Mode',
      desc:'ฝึกแบบไม่กดดัน ไม่ใช้เป็นคะแนนหลัก',
      graded:false,
      color:'practice'
    },
    graded:{
      label:'GRADED',
      title:'Graded Attempt',
      desc:'รอบจริง บันทึกคะแนน เวลา คำตอบ และ event logs',
      graded:true,
      color:'graded'
    },
    remedial:{
      label:'REMEDIAL',
      title:'Remedial Quest',
      desc:'ด่านซ่อมเพื่อเปิด Learning Path',
      graded:false,
      color:'remedial'
    },
    challenge:{
      label:'CHALLENGE',
      title:'Challenge Mode',
      desc:'รอบท้าทายสำหรับเก็บ Mastery / Badge',
      graded:true,
      color:'challenge'
    },
    demo:{
      label:'DEMO',
      title:'Demo Mode',
      desc:'โหมดสาธิต ไม่ควรนับเป็นข้อมูลนักศึกษา',
      graded:false,
      color:'demo'
    }
  };

  const HELP_LEVELS = {
    hint_question:{
      level:1,
      label:'Hint 1: คำถามนำ',
      scorePenalty:0,
      eventValue:'hint_question'
    },
    eliminate_one:{
      level:2,
      label:'Hint 2: ตัดตัวเลือกผิด 1 ข้อ',
      scorePenalty:1,
      eventValue:'eliminate_one'
    },
    concept_explain:{
      level:3,
      label:'Hint 3: อธิบาย concept',
      scorePenalty:2,
      eventValue:'concept_explain'
    }
  };

  const STATUS_LABELS = {
    clear:{
      label:'CLEAR',
      title:'ผ่านแล้ว',
      desc:'เปิด Mission ถัดไปได้',
      next:['next_mission','replay_mastery','mission_map']
    },
    proficient:{
      label:'PROFICIENT',
      title:'ผ่านดี',
      desc:'ได้ 2 ดาว พร้อมไปต่อหรือเล่นซ้ำเพื่อ Mastery',
      next:['next_mission','replay_mastery','mission_map']
    },
    mastered:{
      label:'MASTERED',
      title:'Mastery แล้ว',
      desc:'เปิด Challenge / Badge / Division ต่อไป',
      next:['challenge','next_division','mission_map']
    },
    remedial:{
      label:'NEEDS REMEDIAL',
      title:'ยังควรซ่อมก่อน',
      desc:'แนะนำทำ Remedial Quest หรือ Practice Mode',
      next:['remedial','practice','review_wrong']
    }
  };

  const MIS_GROUPS = {
    automation:'Automation vs AI',
    sensor:'Sensor vs AI',
    database:'Database / Retrieval vs AI',
    retrieval:'Database / Retrieval vs AI',
    rulebased:'Rule-based vs Learning-based',
    internet:'Internet-connected vs AI',
    generative_vs_retrieval:'Generative vs Retrieval',
    prediction:'Prediction vs Calculation',
    ethics:'AI Ethics / Bias / Verification',
    general:'General AI Criteria'
  };

  function nowIso(){
    return new Date().toISOString();
  }

  function defaultState(){
    return {
      version:VERSION,
      runMode:'graded',
      startConfirmed:false,
      saveStatus:'idle',
      lastSavedAttemptId:'',
      saveHistory:[],
      helpUsed:[],
      updatedAt:nowIso()
    };
  }

  function load(){
    try{
      return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
    }catch(error){
      return defaultState();
    }
  }

  function save(state){
    state.updatedAt = nowIso();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function getRunMode(){
    const state = load();
    return RUN_MODES[state.runMode] ? state.runMode : 'graded';
  }

  function setRunMode(mode){
    const state = load();
    state.runMode = RUN_MODES[mode] ? mode : 'graded';
    state.startConfirmed = false;
    save(state);
    updateModeBadge();
    return state.runMode;
  }

  function getRunModeInfo(){
    return RUN_MODES[getRunMode()] || RUN_MODES.graded;
  }

  function shouldConfirmStart(){
    const mode = getRunMode();
    const state = load();
    return RUN_MODES[mode]?.graded && !state.startConfirmed;
  }

  function confirmStart(){
    const state = load();
    state.startConfirmed = true;
    save(state);
  }

  function resetStartConfirm(){
    const state = load();
    state.startConfirmed = false;
    save(state);
  }

  function evaluateResultStatus(summary){
    const score = Number(summary?.score ?? summary?.finalScore ?? 0);
    const accuracy = Number(summary?.accuracy ?? summary?.accuracyPct ?? 0);
    const explainCorrect = Number(summary?.explainCorrect ?? 0);
    const trickCorrect = Number(summary?.trickCorrect ?? 0);
    const bossWin = !!summary?.bossWin;
    const helpUsed = Number(summary?.helpUsed ?? summary?.aiHelpUsed ?? 0);

    let key = 'remedial';
    if(score >= 85 && accuracy >= 80 && explainCorrect >= 2 && trickCorrect >= 2 && bossWin && helpUsed <= 2){
      key = 'mastered';
    }else if(score >= 70 && accuracy >= 65){
      key = 'proficient';
    }else if(score >= 60 || summary?.gateStatus === 'clear' || summary?.gateStars >= 1){
      key = 'clear';
    }

    return {
      key,
      ...STATUS_LABELS[key],
      criteria:{score, accuracy, explainCorrect, trickCorrect, bossWin, helpUsed}
    };
  }

  function groupWrongItems(wrongItems){
    const groups = {};
    (wrongItems || []).forEach(item => {
      const raw = String(item.misconception || item.misKey || item.key || item.coach || '').toLowerCase();
      let g = 'general';
      Object.keys(MIS_GROUPS).forEach(k => {
        if(raw.includes(k)) g = k;
      });
      const label = MIS_GROUPS[g] || MIS_GROUPS.general;
      groups[label] = groups[label] || [];
      groups[label].push(item);
    });
    return groups;
  }

  function renderGroupedWrongReview(wrongItems){
    const groups = groupWrongItems(wrongItems);
    const names = Object.keys(groups);

    if(!names.length){
      return '<b>Review Wrong Items</b><br>ดีมาก ยังไม่พบข้อผิดพลาดสำคัญในรอบนี้';
    }

    return `
      <b>Review Wrong Items by Misconception</b><br>
      ${names.map(name => `
        <div class="wrongReviewItem">
          <strong>${escapeHtml(name)}</strong><br>
          ${groups[name].map(item => `
            <div style="margin-top:8px">
              <b>โจทย์:</b> ${escapeHtml(item.prompt || '-')}<br>
              <b>ตอบ:</b> ${escapeHtml(item.yourAnswer || '-')}<br>
              <b>ควรตอบ:</b> ${escapeHtml(item.correctAnswer || '-')}<br>
              <span>${escapeHtml(item.explanation || item.coach || '')}</span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  }

  function renderResultStatus(container, summary){
    const target = typeof container === 'string' ? document.querySelector(container) : container;
    if(!target) return;

    const status = evaluateResultStatus(summary || {});
    target.innerHTML = `
      <div class="coachBox">
        <b>${status.label}: ${status.title}</b><br>
        ${status.desc}<br>
        <span class="scoreChip">Score ${status.criteria.score}</span>
        <span class="scoreChip">Accuracy ${status.criteria.accuracy}%</span>
        <span class="scoreChip">Explain ${status.criteria.explainCorrect}</span>
        <span class="scoreChip">Trick ${status.criteria.trickCorrect}</span>
      </div>
    `;
  }

  function buildResultActions(summary){
    const status = evaluateResultStatus(summary || {});
    const actions = {
      next_mission:{id:'btnNextMission', text:'ไป Mission ถัดไป', className:'btn good'},
      replay_mastery:{id:'btnReplayMastery', text:'เล่นซ้ำเพื่อ Mastery', className:'btn secondary'},
      mission_map:{id:'btnMissionMap', text:'กลับ Mission Map', className:'btn secondary'},
      remedial:{id:'btnDoRemedial', text:'ทำ Remedial Quest', className:'btn warn'},
      practice:{id:'btnGoPractice', text:'เข้า Practice Mode', className:'btn secondary'},
      review_wrong:{id:'btnReviewWrong', text:'ดู Review ข้อผิด', className:'btn secondary'},
      challenge:{id:'btnChallengeMode', text:'เข้า Challenge Mode', className:'btn good'},
      next_division:{id:'btnNextDivision', text:'ไป Division ถัดไป', className:'btn good'}
    };

    return status.next.map(k => actions[k]).filter(Boolean);
  }

  function canSaveAttempt(attemptId){
    const state = load();
    if(state.saveStatus === 'saving') return {ok:false, reason:'saving'};
    if(state.saveStatus === 'saved' && state.lastSavedAttemptId && state.lastSavedAttemptId === attemptId){
      return {ok:false, reason:'duplicate'};
    }
    return {ok:true, reason:'ok'};
  }

  function setSaveStatus(status, attemptId, extra){
    const state = load();
    state.saveStatus = status || 'idle';
    if(attemptId) state.lastSavedAttemptId = attemptId;
    state.saveHistory.push({
      at:nowIso(),
      status:state.saveStatus,
      attemptId:attemptId || '',
      extra:extra || {}
    });
    state.saveHistory = state.saveHistory.slice(-20);
    save(state);
    updateSaveStatusUI();
    return state;
  }

  function recordHelp(type, context){
    const state = load();
    const level = HELP_LEVELS[type] || HELP_LEVELS.hint_question;
    const row = {
      at:nowIso(),
      type:level.eventValue,
      level:level.level,
      label:level.label,
      context:context || {}
    };
    state.helpUsed.push(row);
    state.helpUsed = state.helpUsed.slice(-50);
    save(state);
    return row;
  }

  function updateModeBadge(){
    let badge = document.getElementById('runModeBadge');
    const info = getRunModeInfo();

    if(!badge){
      const topActions = document.querySelector('.topActions') || document.querySelector('.topbar');
      if(!topActions) return;
      badge = document.createElement('span');
      badge.id = 'runModeBadge';
      badge.className = 'pill';
      topActions.prepend(badge);
    }

    badge.textContent = `MODE: ${info.label}`;
    badge.title = `${info.title} — ${info.desc}`;
  }

  function updateSaveStatusUI(){
    let box = document.getElementById('saveStatusBox');
    if(!box) return;

    const state = load();
    const label = {
      idle:'พร้อมบันทึกผล',
      saving:'กำลังบันทึก...',
      saved:'บันทึกแล้ว',
      pending:'รอ sync',
      failed:'บันทึกไม่สำเร็จ',
      duplicate:'บันทึกแล้ว'
    }[state.saveStatus] || state.saveStatus;

    box.textContent = `Save Status: ${label}`;
  }

  function injectRunModePanel(){
    if(document.getElementById('runModePanel')) return;

    const menu = document.getElementById('menuScreen');
    if(!menu) return;

    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = 'runModePanel';
    panel.style.marginTop = '16px';
    panel.innerHTML = `
      <h2>Run Mode</h2>
      <p>เลือกโหมดก่อนเริ่มเล่น เพื่อแยก Practice / Graded / Remedial / Challenge / Demo ให้ชัดเจนก่อนส่งข้อมูลจริง</p>
      <div class="row">
        ${Object.entries(RUN_MODES).map(([key,mode]) => `
          <button class="btn secondary small" data-run-mode="${key}">${mode.label}</button>
        `).join('')}
      </div>
      <p id="runModeDesc"></p>
    `;

    const firstLayout = menu.querySelector('.layout');
    if(firstLayout){
      menu.insertBefore(panel, firstLayout);
    }else{
      menu.appendChild(panel);
    }

    panel.querySelectorAll('[data-run-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        setRunMode(btn.getAttribute('data-run-mode'));
        renderRunModeDesc();
        if(window.showToast) window.showToast('เปลี่ยนโหมดเป็น ' + getRunModeInfo().title);
      });
    });

    renderRunModeDesc();
  }

  function renderRunModeDesc(){
    const desc = document.getElementById('runModeDesc');
    if(!desc) return;
    const info = getRunModeInfo();
    desc.textContent = `${info.title}: ${info.desc}`;
  }

  function showStartConfirm(onConfirm, onCancel){
    const info = getRunModeInfo();

    if(!shouldConfirmStart()){
      confirmStart();
      if(onConfirm) onConfirm();
      return;
    }

    let back = document.getElementById('startConfirmBack');
    if(!back){
      back = document.createElement('div');
      back.id = 'startConfirmBack';
      back.className = 'modalBack';
      back.innerHTML = `
        <div class="modal">
          <h3>เริ่ม Graded Attempt?</h3>
          <p id="startConfirmText"></p>
          <div class="row" style="justify-content:flex-end">
            <button class="btn secondary" id="btnStartAsPractice">เปลี่ยนเป็น Practice</button>
            <button class="btn secondary" id="btnCancelStartConfirm">ยกเลิก</button>
            <button class="btn good" id="btnConfirmStartAttempt">เริ่มรอบจริง</button>
          </div>
        </div>
      `;
      document.body.appendChild(back);
    }

    const text = document.getElementById('startConfirmText');
    if(text){
      text.textContent = `คุณกำลังจะเริ่ม ${info.title} ระบบจะบันทึกเวลา คำตอบ คะแนน และ event logs สำหรับการเรียนการสอน`;
    }

    back.classList.add('show');

    document.getElementById('btnConfirmStartAttempt').onclick = () => {
      confirmStart();
      back.classList.remove('show');
      if(onConfirm) onConfirm();
    };

    document.getElementById('btnStartAsPractice').onclick = () => {
      setRunMode('practice');
      confirmStart();
      back.classList.remove('show');
      if(onConfirm) onConfirm();
    };

    document.getElementById('btnCancelStartConfirm').onclick = () => {
      back.classList.remove('show');
      if(onCancel) onCancel();
    };
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
    injectRunModePanel();
    updateModeBadge();
    updateSaveStatusUI();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

  window.AIQuestGameplayLockdown = {
    VERSION,
    RUN_MODES,
    HELP_LEVELS,
    STATUS_LABELS,
    load,
    save,
    getRunMode,
    setRunMode,
    getRunModeInfo,
    shouldConfirmStart,
    confirmStart,
    resetStartConfirm,
    showStartConfirm,
    evaluateResultStatus,
    groupWrongItems,
    renderGroupedWrongReview,
    renderResultStatus,
    buildResultActions,
    canSaveAttempt,
    setSaveStatus,
    recordHelp,
    updateModeBadge,
    updateSaveStatusUI
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
