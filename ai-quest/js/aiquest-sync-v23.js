/*
  CSAI2102 AI Quest
  PATCH v2.3 Firebase + Google Sheets Sync
  ------------------------------------------------------------
  หมายเหตุ:
  - ใช้ Google Sheets ผ่าน Apps Script เดิม
  - Firebase config ใส่ใน classroom-config.html หรือ localStorage
  - รองรับ RTDB REST แบบไม่ต้อง import SDK เพื่อให้ใช้บน GitHub Pages ง่าย
*/
(function(){
  'use strict';

  const VERSION = 'v2.3-firebase-google-sheets-sync';
  const STORE_KEY = 'CSAI2102_AIQUEST_SYNC_V23';
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';

  function nowIso(){ return new Date().toISOString(); }
  function uid(prefix){ return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,10); }

  function loadState(){
    try{ return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); }
    catch(error){ return defaultState(); }
  }

  function defaultState(){
    return {
      version:VERSION,
      queue:[],
      lastSync:null,
      lastError:'',
      updatedAt:nowIso()
    };
  }

  function saveState(state){
    state.updatedAt = nowIso();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function getConfig(){
    return window.AIQuestDataContract ? AIQuestDataContract.loadConfig() : {appsScriptUrl:APPS_SCRIPT_URL, cloudTargets:{googleSheets:true,firebase:false}};
  }

  function enqueue(kind, payload){
    const state = loadState();
    const item = {
      queueId:uid('q'),
      kind,
      payload,
      status:'pending',
      tries:0,
      createdAt:nowIso(),
      updatedAt:nowIso()
    };
    state.queue.push(item);
    saveState(state);
    renderSyncStatus();
    return item;
  }

  async function syncAll(){
    const state = loadState();
    const config = getConfig();
    const pending = state.queue.filter(x => x.status === 'pending' || x.status === 'failed');

    for(const item of pending){
      item.tries += 1;
      item.status = 'syncing';
      item.updatedAt = nowIso();
      saveState(state);
      try{
        if(config.cloudTargets?.googleSheets){
          await sendGoogleSheets(item.kind, item.payload, config);
        }
        if(config.cloudTargets?.firebase){
          await sendFirebase(item.kind, item.payload, config);
        }
        item.status = 'synced';
        item.syncedAt = nowIso();
        state.lastSync = nowIso();
        state.lastError = '';
      }catch(error){
        item.status = 'failed';
        item.error = String(error.message || error);
        state.lastError = item.error;
      }
      item.updatedAt = nowIso();
      saveState(state);
      renderSyncStatus();
    }

    return getSummary();
  }

  async function sendGoogleSheets(kind, payload, config){
    const url = config.appsScriptUrl || APPS_SCRIPT_URL;
    const body = {
      action:'sync_v23',
      kind,
      payload: window.AIQuestDataContract ? AIQuestDataContract.decoratePayload(payload) : payload
    };

    await fetch(url, {
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'text/plain;charset=utf-8'},
      body:JSON.stringify(body)
    });

    return {ok:true, opaque:true};
  }

  function firebaseBase(config){
    const fb = config.firebaseConfig || {};
    const db = fb.databaseURL || fb.databaseUrl || '';
    if(!db) throw new Error('Firebase databaseURL missing');
    return db.replace(/\/$/,'');
  }

  function safePath(s){
    return String(s || 'unknown').replace(/[.#$\[\]/]/g, '_');
  }

  async function sendFirebase(kind, payload, config){
    const base = firebaseBase(config);
    const ctx = window.AIQuestDataContract ? AIQuestDataContract.getRuntimeContext() : {};
    const courseId = safePath(payload.courseId || ctx.courseId || 'CSAI2102');
    const classId = safePath(payload.classId || ctx.classId || 'default');
    const sessionId = safePath(payload.sessionId || ctx.sessionId || 's1');

    let path = '';
    let key = '';

    if(kind === 'profile'){
      key = safePath(payload.studentId || uid('student'));
      path = `/aiquest/${courseId}/classes/${classId}/students/${key}.json`;
    }else if(kind === 'attempt'){
      key = safePath(payload.attemptId || uid('att'));
      path = `/aiquest/${courseId}/classes/${classId}/sessions/${sessionId}/attempts/${key}.json`;
    }else if(kind === 'event'){
      key = safePath(payload.eventId || uid('evt'));
      path = `/aiquest/${courseId}/classes/${classId}/sessions/${sessionId}/events/${key}.json`;
    }else if(kind === 'progress'){
      key = safePath(payload.progressId || uid('prog'));
      path = `/aiquest/${courseId}/classes/${classId}/progress/${key}.json`;
    }else{
      key = safePath(uid('item'));
      path = `/aiquest/${courseId}/classes/${classId}/misc/${kind}/${key}.json`;
    }

    const res = await fetch(base + path, {
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(Object.assign({firebaseSyncedAt:nowIso()}, payload))
    });

    if(!res.ok) throw new Error('Firebase sync failed: ' + res.status);
    return await res.json();
  }

  async function submitProfile(profile){
    const p = window.AIQuestDataContract ? AIQuestDataContract.buildStudentProfile(profile) : profile;
    enqueue('profile', p);
    return syncAll();
  }

  async function submitAttempt(summary){
    const a = window.AIQuestDataContract ? AIQuestDataContract.buildAttempt(summary) : summary;
    const validation = window.AIQuestDataContract ? AIQuestDataContract.validateAttempt(a) : {ok:true, errors:[]};
    if(!validation.ok) throw new Error('Attempt invalid: ' + validation.errors.join(', '));

    enqueue('attempt', a);

    const events = summary?.events || [];
    events.forEach(evt => {
      const e = window.AIQuestDataContract ? AIQuestDataContract.buildEvent(evt, a) : evt;
      enqueue('event', e);
    });

    return syncAll();
  }

  async function submitEvent(event, attempt){
    const e = window.AIQuestDataContract ? AIQuestDataContract.buildEvent(event, attempt) : event;
    enqueue('event', e);
    return syncAll();
  }

  function getSummary(){
    const state = loadState();
    const counts = state.queue.reduce((acc,item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    return {
      version:VERSION,
      total:state.queue.length,
      counts,
      lastSync:state.lastSync,
      lastError:state.lastError
    };
  }

  function clearSynced(){
    const state = loadState();
    state.queue = state.queue.filter(x => x.status !== 'synced');
    saveState(state);
    renderSyncStatus();
  }

  function renderSyncStatus(container){
    const target = typeof container === 'string' ? document.querySelector(container) : (container || document.getElementById('syncStatusBox'));
    if(!target) return;
    const s = getSummary();
    target.innerHTML = `
      <div class="coachBox">
        <b>Sync v2.3</b><br>
        Total: ${s.total} |
        Pending: ${s.counts.pending || 0} |
        Syncing: ${s.counts.syncing || 0} |
        Synced: ${s.counts.synced || 0} |
        Failed: ${s.counts.failed || 0}<br>
        Last Sync: ${s.lastSync || '-'}
        ${s.lastError ? '<br><b>Error:</b> ' + escapeHtml(s.lastError) : ''}
      </div>
    `;
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function boot(){
    if(!document.getElementById('syncStatusBox')){
      const resultScreen = document.getElementById('resultScreen');
      if(resultScreen){
        const box = document.createElement('section');
        box.className = 'panel';
        box.id = 'syncStatusBox';
        box.style.marginTop = '16px';
        resultScreen.appendChild(box);
      }
    }
    renderSyncStatus();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.AIQuestSync = {
    VERSION,
    loadState,
    saveState,
    enqueue,
    syncAll,
    submitProfile,
    submitAttempt,
    submitEvent,
    getSummary,
    clearSynced,
    renderSyncStatus
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
