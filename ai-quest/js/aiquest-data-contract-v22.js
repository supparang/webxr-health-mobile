/*
  CSAI2102 AI Quest
  PATCH v2.2 Data Contract + Classroom Config
  ------------------------------------------------------------
  ล็อก schema กลางก่อน Firebase/Google Sheets
*/
(function(){
  'use strict';

  const VERSION = 'v2.4.2-data-contract-production';
  const STORE_KEY = 'CSAI2102_AIQUEST_DATA_CONTRACT_V22';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
  const SECTION_LOCK = '101';
  const CLASS_ID_LOCK = 'CSAI2102-2569-101';

  const DEFAULT_CONFIG = {
    courseId:'CSAI2102',
    courseName:'Artificial Intelligence Principles',
    term:'1/2569',
    classId:'CSAI2102-2569-101',
    section:'101',
    teacherId:'supparang',
    activeSession:'s1',
    enabledSessions:['s1'],
    runMode:'graded',
    timerEnabled:true,
    leaderboardEnabled:false,
    feedbackPolicy:'immediate',
    scorePolicy:'best_graded',
    allowPractice:true,
    allowRemedial:true,
    allowChallenge:true,
    cloudTargets:{ googleSheets:true, firebase:false },
    appsScriptUrl:APPS_SCRIPT_URL,
    firebaseConfig:null
  };

  const SCHEMA_VERSION = '2.2.0';

  function nowIso(){ return new Date().toISOString(); }
  function uid(prefix){ return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,10); }

  function normalizeClassConfig(config){
    const c = Object.assign({}, config || {});
    c.courseId = 'CSAI2102';
    c.term = c.term || '1/2569';
    c.classId = CLASS_ID_LOCK;
    c.section = SECTION_LOCK;
    return c;
  }

  function loadConfig(){
    try{
      return normalizeClassConfig(Object.assign({}, DEFAULT_CONFIG, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')));
    }catch(error){
      return normalizeClassConfig(Object.assign({}, DEFAULT_CONFIG));
    }
  }

  function saveConfig(config){
    const c = normalizeClassConfig(Object.assign({}, loadConfig(), config || {}));
    c.updatedAt = nowIso();
    localStorage.setItem(STORE_KEY, JSON.stringify(c));
    return c;
  }

  function getRuntimeContext(){
    const c = loadConfig();
    const classroom = window.AIQuestClassroomEntry ? AIQuestClassroomEntry.getClassroom() : {};
    const profile = window.AIQuestStorage ? AIQuestStorage.getProfile() : {};
    const mode = window.AIQuestGameplayLockdown ? AIQuestGameplayLockdown.getRunMode() : (classroom.mode || c.runMode || 'graded');

    return {
      schemaVersion:SCHEMA_VERSION,
      courseId:classroom.courseId || c.courseId,
      courseName:c.courseName,
      term:classroom.term || c.term,
      classId:CLASS_ID_LOCK,
      section:SECTION_LOCK,
      teacherId:classroom.teacherId || c.teacherId,
      sessionId:classroom.sessionId || c.activeSession,
      runMode:mode,
      scorePolicy:c.scorePolicy,
      feedbackPolicy:c.feedbackPolicy,
      leaderboardEnabled:!!c.leaderboardEnabled,
      pageUrl:location.href,
      userAgent:navigator.userAgent,
      clientTs:nowIso()
    };
  }

  function buildStudentProfile(profile){
    const ctx = getRuntimeContext();
    profile = profile || (window.AIQuestStorage ? AIQuestStorage.getProfile() : {});
    return {
      schemaVersion:SCHEMA_VERSION,
      profileId:profile.profileId || uid('profile'),
      studentId:String(profile.studentId || '').trim(),
      studentName:String(profile.studentName || '').trim(),
      section:SECTION_LOCK,
      courseId:ctx.courseId,
      classId:CLASS_ID_LOCK,
      term:ctx.term,
      teacherId:ctx.teacherId,
      consent: !!(profile.consent || profile.dataConsent || (window.AIQuestClassroomEntry && AIQuestClassroomEntry.isEntryConfirmed())),
      createdAt:profile.createdAt || nowIso(),
      updatedAt:nowIso()
    };
  }

  
  function pickReflection_(summary, key, domId){
    summary = summary || {};
    const direct = summary[key];
    if(direct != null && String(direct).trim()) return String(direct).trim();

    const extra = summary.extraJson || summary.extra || {};
    if(extra && extra.reflections && extra.reflections[key] != null && String(extra.reflections[key]).trim()){
      return String(extra.reflections[key]).trim();
    }

    try{
      const node = document.getElementById(domId);
      if(node && node.value != null && String(node.value).trim()){
        return String(node.value).trim();
      }
    }catch(error){}

    return '';
  }

  function buildAttempt(summary){
    const ctx = getRuntimeContext();
    summary = summary || {};
    const attemptId = summary.attemptId || uid('att');
    return {
      schemaVersion:SCHEMA_VERSION,
      attemptId,
      studentId:summary.studentId || '',
      studentName:summary.studentName || '',
      section:SECTION_LOCK,
      courseId:ctx.courseId,
      classId:CLASS_ID_LOCK,
      term:ctx.term,
      teacherId:ctx.teacherId,
      sessionId:summary.sessionId || ctx.sessionId,
      missionId:summary.missionId || 'm1',
      runMode:summary.runMode || ctx.runMode,
      submitStatus:summary.submitStatus || 'submitted',
      score:Number(summary.score || summary.finalScore || 0),
      accuracy:Number(summary.accuracy || summary.accuracyPct || 0),
      stars:Number(summary.stars || summary.gateStars || 0),
      gateStatus:summary.gateStatus || '',
      gatePath:summary.gatePath || '',
      bossWin:!!summary.bossWin,
      explainCorrect:Number(summary.explainCorrect || 0),
      trickCorrect:Number(summary.trickCorrect || 0),
      helpUsed:Number(summary.helpUsed || summary.aiHelpUsed || 0),
      startedAt:summary.startedAt || '',
      submittedAt:summary.submittedAt || nowIso(),
      clientTs:summary.clientTs || nowIso(),
      pageUrl:ctx.pageUrl,
      userAgent:ctx.userAgent,
      reflection1:pickReflection_(summary, 'reflection1', 'ref1'),
      reflection2:pickReflection_(summary, 'reflection2', 'ref2'),
      reflection3:pickReflection_(summary, 'reflection3', 'ref3'),
      bestAttemptPolicy:ctx.scorePolicy,
      isPractice:ctx.runMode === 'practice',
      isGraded:['graded','challenge'].includes(ctx.runMode),
      rawJson: safeJson(summary)
    };
  }

  function buildEvent(event, attempt){
    const ctx = getRuntimeContext();
    event = event || {};
    attempt = attempt || {};
    return {
      schemaVersion:SCHEMA_VERSION,
      eventId:event.eventId || uid('evt'),
      attemptId:event.attemptId || attempt.attemptId || '',
      studentId:event.studentId || attempt.studentId || '',
      section:SECTION_LOCK,
      courseId:ctx.courseId,
      classId:CLASS_ID_LOCK,
      term:ctx.term,
      sessionId:event.sessionId || attempt.sessionId || ctx.sessionId,
      missionId:event.missionId || attempt.missionId || 'm1',
      runMode:event.runMode || attempt.runMode || ctx.runMode,
      eventType:event.eventType || '',
      phase:event.phase || '',
      itemId:event.itemId || '',
      prompt:event.prompt || '',
      yourAnswer:event.yourAnswer || '',
      correctAnswer:event.correctAnswer || '',
      isCorrect:event.isCorrect === '' ? '' : !!event.isCorrect,
      confidence:event.confidence || '',
      misconception:event.misconception || event.extraJson?.misconception || event.extraJson?.misconceptionKey || '',
      helpType:event.helpType || '',
      scoreDelta:Number(event.scoreDelta || 0),
      combo:Number(event.combo || 0),
      helpLeft:Number(event.helpLeft || 0),
      clientTs:event.clientTs || nowIso(),
      pageUrl:ctx.pageUrl,
      userAgent:ctx.userAgent,
      extraJson:safeJson(event.extraJson || {})
    };
  }

  function buildProgress(input){
    const ctx = getRuntimeContext();
    input = input || {};
    return {
      schemaVersion:SCHEMA_VERSION,
      progressId:input.progressId || uid('prog'),
      studentId:input.studentId || '',
      courseId:ctx.courseId,
      classId:CLASS_ID_LOCK,
      term:ctx.term,
      sessionId:input.sessionId || ctx.sessionId,
      missionId:input.missionId || 'm1',
      status:input.status || 'available',
      stars:Number(input.stars || 0),
      bestScore:Number(input.bestScore || 0),
      unlocked:!!input.unlocked,
      updatedAt:nowIso()
    };
  }

  function validateAttempt(a){
    const errors = [];
    ['attemptId','studentId','courseId','classId','term','sessionId','missionId','runMode'].forEach(k => {
      if(!a[k]) errors.push(k + ' required');
    });
    if(!Number.isFinite(Number(a.score))) errors.push('score invalid');
    return {ok:errors.length === 0, errors};
  }

  function validateProfile(p){
    const errors = [];
    ['studentId','studentName','section','courseId','classId','term'].forEach(k => {
      if(!p[k]) errors.push(k + ' required');
    });
    return {ok:errors.length === 0, errors};
  }

  function safeJson(v){
    try{ return JSON.stringify(v || {}); }catch(error){ return '{}'; }
  }

  function decoratePayload(payload){
    const ctx = getRuntimeContext();
    return Object.assign({
      schemaVersion:SCHEMA_VERSION,
      courseId:ctx.courseId,
      classId:CLASS_ID_LOCK,
      term:ctx.term,
      teacherId:ctx.teacherId,
      runMode:ctx.runMode,
      clientTs:nowIso()
    }, payload || {});
  }

  function renderConfigPanel(container){
    const target = typeof container === 'string' ? document.querySelector(container) : container;
    if(!target) return;
    const c = loadConfig();
    target.innerHTML = `
      <div class="coachBox">
        <b>Data Contract ${VERSION}</b><br>
        <b>Course:</b> ${escapeHtml(c.courseId)} |
        <b>Class:</b> ${escapeHtml(c.classId)} |
        <b>Term:</b> ${escapeHtml(c.term)} |
        <b>Score Policy:</b> ${escapeHtml(c.scorePolicy)}<br>
        <b>Cloud:</b> Google Sheets ${c.cloudTargets.googleSheets ? 'ON' : 'OFF'} / Firebase ${c.cloudTargets.firebase ? 'ON' : 'OFF'}
      </div>
    `;
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  window.AIQuestDataContract = {
    VERSION,
    SCHEMA_VERSION,
    DEFAULT_CONFIG,
    loadConfig,
    saveConfig,
    getRuntimeContext,
    buildStudentProfile,
    buildAttempt,
    buildEvent,
    buildProgress,
    validateAttempt,
    validateProfile,
    decoratePayload,
    renderConfigPanel
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
