/*
  CSAI2102 AI Quest
  v3.6.5 — Canonical Gate Engine Sync + B2 Return/S2 AR Bootstrap
  -----------------------------------------------------------------
  Canonical flow: S1 -> S2 -> S3 -> B1 -> S4 -> S5 -> S6 -> B2
  This patch keeps the remaining legacy core helpers synchronized with
  the canonical gate rules, while preserving the B2 return and S2 AR bridge.
*/
(function(){
  'use strict';

  const VERSION = 'v3.6.5-canonical-engine-sync-b2-return';
  const PROGRESS_KEY = 'CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const MIGRATION_KEY = 'canonicalGateMigrationV363';
  const RELOAD_KEY = 'AIQUEST_CANONICAL_GATE_RELOAD_V363';

  function toast(message){
    try{
      if(typeof showToast === 'function') showToast(message);
      else console.log('[AIQuest]', message);
    }catch(error){
      console.log('[AIQuest]', message);
    }
  }

  function readProgress(){
    try{
      const state = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      return state && typeof state === 'object' ? state : {};
    }catch(error){
      return {};
    }
  }

  function writeProgress(state){
    try{
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(state || {}));
      return true;
    }catch(error){
      return false;
    }
  }

  function passed(state, id){
    const st = state || {};
    return !!(
      (st.completed && st.completed[id]) ||
      (st.stars && Number(st.stars[id] || 0) > 0) ||
      (st.mastered && st.mastered[id]) ||
      (st.bestScore && Number(st.bestScore[id] || 0) >= 60)
    );
  }

  function stageSnapshot(state, id){
    const st = state || {};
    return {
      completed:!!(st.completed && st.completed[id]),
      stars:Number(st.stars && st.stars[id] || 0),
      mastered:!!(st.mastered && st.mastered[id]),
      bestScore:st.bestScore && st.bestScore[id] != null ? Number(st.bestScore[id]) : null
    };
  }

  function clearStage(state, id){
    ['completed','stars','mastered','bestScore'].forEach(key => {
      if(state[key] && Object.prototype.hasOwnProperty.call(state[key], id)) delete state[key][id];
    });
  }

  function canonicalNextId(state){
    const st = state || readProgress();
    const flow = ['m1','m2','m3','b1','m4','m5','m6','b2'];
    return flow.find(id => !passed(st, id)) || 'b2';
  }

  function canonicalB2Ready(){
    const state = readProgress();
    return ['m4','m5','m6'].every(id => passed(state, id));
  }

  function patchLegacyGateHelpers(){
    /* boss2Ready() is called inside the original startMission closure.
       Because it is a top-level classic-script function, replacing the
       global binding updates the condition used by that legacy engine. */
    if(typeof window.boss2Ready === 'function' && !window.boss2Ready.__aiquestCanonicalB2V365){
      const canonical = function(){ return canonicalB2Ready(); };
      canonical.__aiquestCanonicalB2V365 = true;
      canonical.__legacyBoss2Ready = window.boss2Ready;
      window.boss2Ready = canonical;
    }

    /* Keeps older renderStats/updateTopQuickButton output aligned during
       the short interval before the Roadmap renderer paints its own label. */
    if(typeof window.nextQuickMissionId === 'function' && !window.nextQuickMissionId.__aiquestCanonicalNextV365){
      const canonical = function(){ return canonicalNextId(readProgress()); };
      canonical.__aiquestCanonicalNextV365 = true;
      canonical.__legacyNextQuickMissionId = window.nextQuickMissionId;
      window.nextQuickMissionId = canonical;
    }
  }

  function migrateLegacyGatePasses(){
    const state = readProgress();
    if(state[MIGRATION_KEY] && state[MIGRATION_KEY].applied){
      return {applied:false, already:true, invalidated:[]};
    }

    const invalidated = [];
    const archive = state.legacyGateArchive && typeof state.legacyGateArchive === 'object'
      ? state.legacyGateArchive
      : {};

    /* Old B1 was taken before S3; it cannot certify Search Foundations. */
    if(passed(state, 'b1')){
      archive.b1LegacyBeforeS3 = {
        ...stageSnapshot(state, 'b1'),
        archivedAt:new Date().toISOString(),
        reason:'Legacy B1 preceded S3 and did not contain Search Foundations evidence.'
      };
      clearStage(state, 'b1');
      invalidated.push('B1');
    }

    /* Old B2 was taken before S6; it cannot certify Knowledge Representation. */
    if(passed(state, 'b2')){
      archive.b2LegacyBeforeS6 = {
        ...stageSnapshot(state, 'b2'),
        archivedAt:new Date().toISOString(),
        reason:'Legacy B2 preceded S6 and did not contain Knowledge Representation evidence.'
      };
      clearStage(state, 'b2');
      invalidated.push('B2');
    }

    state.legacyGateArchive = archive;
    state[MIGRATION_KEY] = {
      applied:true,
      version:VERSION,
      appliedAt:new Date().toISOString(),
      invalidated,
      rationale:'Canonical course flow requires B1 after S1-S3 and B2 after S4-S6.'
    };
    writeProgress(state);
    return {applied:true, already:false, invalidated};
  }

  function reloadAfterMigration(){
    try{
      if(sessionStorage.getItem(RELOAD_KEY) === '1') return false;
      sessionStorage.setItem(RELOAD_KEY, '1');
      setTimeout(() => location.reload(), 80);
      return true;
    }catch(error){
      return false;
    }
  }

  function suppress(ms){
    try{
      sessionStorage.setItem('AIQUEST_SUPPRESS_AUTOSTART_UNTIL', String(Date.now() + (ms || 10000)));
      if(typeof window.AIQUEST_SUPPRESS_AUTOSTART === 'function') window.AIQUEST_SUPPRESS_AUTOSTART(ms || 10000);
    }catch(error){}
  }

  function isTeacherPage(){
    try{
      return window.AIQUEST_PAGE_ROLE === 'teacher' || new URLSearchParams(location.search).get('teacher') === '1';
    }catch(error){
      return false;
    }
  }

  function readJson(key){
    try{ return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch(error){ return null; }
  }

  /* The retired V403 sender was an interim experiment. Suppress it before
     the V405 bridge loads so that a completed S2 AR run creates one event. */
  function suppressLegacyS2Sender(){
    const result = readJson('AIQUEST_S2_AR_RESULT_V387');
    if(!result || !result.arCompleted || (result.sessionId !== 's2' && result.missionId !== 'm2')) return;
    const signature = [
      result.finishedAt || '', result.correct || 0, result.total || 0,
      result.arScore ?? result.accuracy ?? 0, result.helpUsed || 0
    ].join('|');
    const current = readJson('AIQUEST_S2_AR_EVENT_SYNC_V403') || {};
    if(current.signature === signature && current.status === 'queued') return;
    try{
      localStorage.setItem('AIQUEST_S2_AR_EVENT_SYNC_V403', JSON.stringify({
        signature,
        status:'queued',
        owner:'s2-ar-v405-bootstrap',
        queuedAt:new Date().toISOString()
      }));
    }catch(error){}
  }

  function loadS2ResultBridge(){
    if(isTeacherPage()) return;
    if(document.querySelector('script[data-aiquest-s2-bridge-v405]')) return;
    suppressLegacyS2Sender();
    const script = document.createElement('script');
    script.src = './js/aiquest-s2-ar-result-bridge-v405.js?v=20260629-s2bridge405';
    script.async = false;
    script.dataset.aiquestS2BridgeV405 = '1';
    script.onload = () => console.log('[AIQuest] S2 AR V405 bridge loaded');
    script.onerror = () => console.warn('[AIQuest] S2 AR V405 bridge could not load');
    document.head.appendChild(script);
  }

  function isB2Context(){
    try{
      const query = new URLSearchParams(location.search);
      if((query.get('session') || '').toLowerCase() === 'b2') return true;
      if((window.currentMission && window.currentMission.id) === 'b2') return true;
      const pageText = document.body ? (document.body.innerText || '') : '';
      return /B2:\s*(Search Arena Boss|Applied AI Boss Gate)/i.test(pageText) || /Search Arena Boss|Applied AI Boss Gate/i.test(pageText);
    }catch(error){
      return false;
    }
  }

  function goRoadmap(){
    suppress(12000);
    try{
      if(typeof renderRoadmap === 'function'){
        renderRoadmap();
        return true;
      }
    }catch(error){}
    try{
      if(typeof showRoadmap === 'function'){
        showRoadmap();
        return true;
      }
    }catch(error){}
    try{
      if(typeof renderHome === 'function'){
        renderHome();
        return true;
      }
    }catch(error){}
    try{
      if(window.AIQuestRoadmap && typeof window.AIQuestRoadmap.render === 'function'){
        window.AIQuestRoadmap.render();
        document.getElementById('menuScreen')?.classList.add('active');
        document.getElementById('gameScreen')?.classList.remove('active');
        document.getElementById('resultScreen')?.classList.remove('active');
        return true;
      }
    }catch(error){}
    return false;
  }

  function patchSubmitButtons(){
    Array.from(document.querySelectorAll('button')).forEach(button => {
      if(button.__b2ReturnFixV365) return;
      const label = String(button.innerText || button.textContent || '').trim();
      if(!/บันทึก|ส่งผล|submit|save/i.test(label)) return;
      button.__b2ReturnFixV365 = true;
      button.setAttribute('data-no-roadmap-click','1');
      button.addEventListener('click', function(){
        if(!isB2Context()) return;
        suppress(15000);
        setTimeout(function(){
          suppress(15000);
          const ok = goRoadmap();
          toast(ok ? 'บันทึก B2 แล้ว กลับหน้ารวมแล้ว' : 'บันทึก B2 แล้ว ไม่เริ่มรอบใหม่');
        }, 900);
        setTimeout(function(){
          suppress(15000);
          goRoadmap();
        }, 2200);
      }, true);
    });
  }

  function patchStartMission(){
    if(typeof window.startMission !== 'function' || window.startMission.__b2ReturnFixV365) return false;
    const original = window.startMission;
    window.startMission = function(id){
      try{
        const until = Number(sessionStorage.getItem('AIQUEST_SUPPRESS_AUTOSTART_UNTIL') || 0);
        if(Date.now() < until && String(id).toLowerCase() === 'b2'){
          toast('บันทึกแล้ว: ไม่เริ่ม B2 รอบใหม่อัตโนมัติ');
          return;
        }
      }catch(error){}
      return original.apply(this, arguments);
    };
    window.startMission.__b2ReturnFixV365 = true;
    return true;
  }

  function observe(){
    const migration = migrateLegacyGatePasses();
    if(migration.applied && migration.invalidated.length){
      reloadAfterMigration();
      return;
    }

    patchLegacyGateHelpers();
    loadS2ResultBridge();
    patchSubmitButtons();
    patchStartMission();

    if(!window.__AIQUEST_B2_RETURN_OBSERVER_V365){
      window.__AIQUEST_B2_RETURN_OBSERVER_V365 = new MutationObserver(function(){
        patchLegacyGateHelpers();
        patchSubmitButtons();
        patchStartMission();
      });
      window.__AIQUEST_B2_RETURN_OBSERVER_V365.observe(document.body || document.documentElement, {childList:true, subtree:true});
    }
  }

  window.AIQUEST_B2_SUBMIT_RETURN_FIX = {
    version:VERSION,
    suppress,
    goRoadmap,
    patchSubmitButtons,
    patchStartMission,
    patchLegacyGateHelpers,
    migrateLegacyGatePasses,
    refresh:observe
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe);
  else observe();

  console.log('[AIQuest] ' + VERSION + ' loaded', window.AIQUEST_B2_SUBMIT_RETURN_FIX);
})();
