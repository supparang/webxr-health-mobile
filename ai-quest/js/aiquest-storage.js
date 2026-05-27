/*
  CSAI2102 AI Quest Storage
  Version: v1.6
  Purpose: Student Profile + Local Attempts + Pending Cloud Queue
*/
(function(){
  'use strict';
  const PROFILE_KEY = 'CSAI2102_AIQUEST_PROFILE_V1';
  const ATTEMPTS_KEY = 'CSAI2102_AIQUEST_ATTEMPTS_V1';
  const PENDING_KEY = 'CSAI2102_AIQUEST_PENDING_CLOUD_V1';
  const CONFIG_KEY = 'CSAI2102_AIQUEST_CONFIG_V1';

  function nowIso(){ return new Date().toISOString(); }
  function uid(prefix='id'){
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10);
  }
  function readJson(key, fallback){
    try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(e){ return fallback; }
  }
  function writeJson(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  function getProfile(){
    return readJson(PROFILE_KEY, {studentId:'',studentName:'',section:'',nickname:'',email:'',createdAt:'',updatedAt:''});
  }
  function saveProfile(profile){
    const old = getProfile();
    const next = {
      ...old,
      ...profile,
      studentId:String(profile.studentId || old.studentId || '').trim(),
      studentName:String(profile.studentName || old.studentName || '').trim(),
      section:String(profile.section || old.section || '').trim(),
      nickname:String(profile.nickname || old.nickname || '').trim(),
      email:String(profile.email || old.email || '').trim(),
      createdAt: old.createdAt || nowIso(),
      updatedAt: nowIso(),
      userAgent:navigator.userAgent
    };
    writeJson(PROFILE_KEY, next);
    return next;
  }
  function isProfileReady(profile){ const p = profile || getProfile(); return !!(p.studentId && p.studentName && p.section); }

  function getAttempts(){ return readJson(ATTEMPTS_KEY, []); }
  function saveAttempt(attempt){
    const attempts = getAttempts();
    const next = {...attempt, attemptId:attempt.attemptId || uid('att'), clientTs:attempt.clientTs || nowIso(), userAgent:navigator.userAgent, pageUrl:location.href};
    attempts.push(next);
    writeJson(ATTEMPTS_KEY, attempts.slice(-300));
    return next;
  }
  function clearAttempts(){ writeJson(ATTEMPTS_KEY, []); }

  function getPending(){ return readJson(PENDING_KEY, []); }
  function addPending(payload){
    const q = getPending();
    q.push({queueId:uid('q'), payload, createdAt:nowIso(), retryCount:0});
    writeJson(PENDING_KEY, q.slice(-300));
  }
  function setPending(queue){ writeJson(PENDING_KEY, Array.isArray(queue) ? queue : []); }

  function getConfig(){ return readJson(CONFIG_KEY, {apiUrl:'',cloudEnabled:true}); }
  function saveConfig(config){ const next = {...getConfig(), ...config}; writeJson(CONFIG_KEY, next); return next; }
  function exportAttemptsJson(){ return JSON.stringify(getAttempts(), null, 2); }
  function attemptsToCsv(attempts){
    const rows = attempts || getAttempts();
    const headers = ['attemptId','studentId','studentName','section','sessionId','missionId','difficulty','score','stars','mastered','usedTimeSec','accuracy','maxCombo','helpUsed','trickCorrect','explainCorrect','bossWin','clientTs'];
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g,'""') + '"';
    return [headers.join(',')].concat(rows.map(r => headers.map(h => esc(r[h])).join(','))).join('\n');
  }

  window.AIQuestStorage = {PROFILE_KEY,ATTEMPTS_KEY,PENDING_KEY,CONFIG_KEY,uid,nowIso,getProfile,saveProfile,isProfileReady,getAttempts,saveAttempt,clearAttempts,getPending,addPending,setPending,getConfig,saveConfig,exportAttemptsJson,attemptsToCsv};
})();
