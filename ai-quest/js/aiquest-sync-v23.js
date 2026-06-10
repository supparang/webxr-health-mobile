/*
  CSAI2102 AI Quest
  PATCH v2.3.1 Google Sheets First Sync
  ------------------------------------------------------------
  เป้าหมาย:
  - ให้ Google Sheets ส่งได้แม้ Firebase ยังไม่พร้อม
  - ถ้า Firebase ON แต่ไม่มี databaseURL ให้ skip Firebase ไม่ให้ลากทั้ง sync fail
  - แก้ Save Status ไม่ให้ค้าง "กำลังบันทึก..."
  - มี queue / retry / clear failed
*/
(function(){
  'use strict';

  const VERSION = 'v2.3.3-google-sheets-reflection-fix';
  const STORE_KEY = 'CSAI2102_AIQUEST_SYNC_V23';
  const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';

  function nowIso(){
    return new Date().toISOString();
  }

  function uid(prefix){
    return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  function defaultState(){
    return {
      version: VERSION,
      queue: [],
      lastSync: null,
      lastError: '',
      updatedAt: nowIso()
    };
  }

  function loadState(){
    try{
      return Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
    }catch(error){
      return defaultState();
    }
  }

  function saveState(state){
    state.updatedAt = nowIso();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function getConfig(){
    const fallback = {
      appsScriptUrl: DEFAULT_APPS_SCRIPT_URL,
      cloudTargets: {
        googleSheets: true,
        firebase: false
      },
      firebaseConfig: null
    };

    if(window.AIQuestDataContract && AIQuestDataContract.loadConfig){
      const c = AIQuestDataContract.loadConfig();
      return Object.assign({}, fallback, c, {
        cloudTargets: Object.assign({}, fallback.cloudTargets, c.cloudTargets || {})
      });
    }

    return fallback;
  }

  function normalizeConfig(config){
    config = config || getConfig();

    config.appsScriptUrl = config.appsScriptUrl || DEFAULT_APPS_SCRIPT_URL;
    config.cloudTargets = Object.assign({
      googleSheets: true,
      firebase: false
    }, config.cloudTargets || {});

    const firebaseEnabled = !!config.cloudTargets.firebase;
    const firebaseReady = !!(
      config.firebaseConfig &&
      (
        config.firebaseConfig.databaseURL ||
        config.firebaseConfig.databaseUrl
      )
    );

    if(firebaseEnabled && !firebaseReady){
      console.warn('[AIQuestSync] Firebase is ON but databaseURL missing. Firebase sync will be skipped.');
      config.cloudTargets.firebase = false;
      config.firebaseSkippedReason = 'Firebase databaseURL missing';
    }

    return config;
  }

  function enqueue(kind, payload){
    const state = loadState();

    const item = {
      queueId: uid('q'),
      kind,
      payload: payload || {},
      status: 'pending',
      tries: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    state.queue.push(item);
    saveState(state);
    renderSyncStatus();

    return item;
  }

  async function syncAll(){
    const state = loadState();
    const config = normalizeConfig(getConfig());

    const pending = state.queue.filter(item =>
      item.status === 'pending' ||
      item.status === 'failed'
    );

    for(const item of pending){
      item.tries += 1;
      item.status = 'syncing';
      item.updatedAt = nowIso();
      saveState(state);
      renderSyncStatus();

      const result = {
        googleSheets: 'skipped',
        firebase: 'skipped'
      };

      try{
        if(config.cloudTargets.googleSheets){
          await sendGoogleSheets(item.kind, item.payload, config);
          result.googleSheets = 'synced';
        }

        if(config.cloudTargets.firebase){
          await sendFirebase(item.kind, item.payload, config);
          result.firebase = 'synced';
        }else if(config.firebaseSkippedReason){
          result.firebase = 'skipped: ' + config.firebaseSkippedReason;
        }

        item.status = 'synced';
        item.result = result;
        item.syncedAt = nowIso();
        item.error = '';
        state.lastSync = nowIso();
        state.lastError = '';

      }catch(error){
        item.status = 'failed';
        item.error = String(error && error.message || error);
        item.result = result;
        state.lastError = item.error;
      }

      item.updatedAt = nowIso();
      saveState(state);
      renderSyncStatus();
    }

    const summary = getSummary();
    updateSaveStatusFromSummary(summary);
    return summary;
  }

  async function sendGoogleSheets(kind, payload, config){
    const url = (config && config.appsScriptUrl) || DEFAULT_APPS_SCRIPT_URL;

    if(!url){
      throw new Error('Apps Script URL missing');
    }

    const body = {
      action: 'sync_v23',
      kind,
      payload: window.AIQuestDataContract && AIQuestDataContract.decoratePayload
        ? AIQuestDataContract.decoratePayload(payload)
        : payload
    };

    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(body)
    });

    return {
      ok: true,
      opaque: true
    };
  }

  function firebaseBase(config){
    const fb = (config && config.firebaseConfig) || {};
    const db = fb.databaseURL || fb.databaseUrl || '';

    if(!db){
      throw new Error('Firebase databaseURL missing');
    }

    return db.replace(/\/$/, '');
  }

  function safePath(s){
    return String(s || 'unknown').replace(/[.#$\[\]/]/g, '_');
  }

  async function sendFirebase(kind, payload, config){
    const base = firebaseBase(config);
    const ctx = window.AIQuestDataContract && AIQuestDataContract.getRuntimeContext
      ? AIQuestDataContract.getRuntimeContext()
      : {};

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
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(Object.assign({
        firebaseSyncedAt: nowIso()
      }, payload))
    });

    if(!res.ok){
      throw new Error('Firebase sync failed: HTTP ' + res.status);
    }

    return await res.json();
  }

  async function submitProfile(profile){
    const p = window.AIQuestDataContract && AIQuestDataContract.buildStudentProfile
      ? AIQuestDataContract.buildStudentProfile(profile)
      : profile;

    enqueue('profile', p);
    const result = await syncAll();

    return result;
  }

  async function submitAttempt(summary){
    const a = window.AIQuestDataContract && AIQuestDataContract.buildAttempt
      ? AIQuestDataContract.buildAttempt(summary)
      : summary;

    const validation = window.AIQuestDataContract && AIQuestDataContract.validateAttempt
      ? AIQuestDataContract.validateAttempt(a)
      : {ok: true, errors: []};

    if(!validation.ok){
      throw new Error('Attempt invalid: ' + validation.errors.join(', '));
    }

    enqueue('attempt', a);

    const events = summary && Array.isArray(summary.events)
      ? summary.events
      : [];

    events.forEach(evt => {
      const e = window.AIQuestDataContract && AIQuestDataContract.buildEvent
        ? AIQuestDataContract.buildEvent(evt, a)
        : evt;

      enqueue('event', e);
    });

    const result = await syncAll();

    if(window.AIQuestGameplayLockdown && AIQuestGameplayLockdown.setSaveStatus){
      const failed = result.counts && Number(result.counts.failed || 0) > 0;
      AIQuestGameplayLockdown.setSaveStatus(
        failed ? 'failed' : 'saved',
        a.attemptId || ''
      );
    }

    return result;
  }

  async function submitEvent(event, attempt){
    const e = window.AIQuestDataContract && AIQuestDataContract.buildEvent
      ? AIQuestDataContract.buildEvent(event, attempt)
      : event;

    enqueue('event', e);
    const result = await syncAll();

    return result;
  }

  function updateSaveStatusFromSummary(summary){
    if(!window.AIQuestGameplayLockdown || !AIQuestGameplayLockdown.setSaveStatus){
      return;
    }

    const counts = (summary && summary.counts) || {};
    const failed = Number(counts.failed || 0);
    const pending = Number(counts.pending || 0);
    const syncing = Number(counts.syncing || 0);

    if(failed > 0){
      AIQuestGameplayLockdown.setSaveStatus('failed', '');
    }else if(pending > 0 || syncing > 0){
      AIQuestGameplayLockdown.setSaveStatus('pending', '');
    }else{
      AIQuestGameplayLockdown.setSaveStatus('saved', '');
    }
  }

  function getSummary(){
    const state = loadState();

    const counts = state.queue.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    return {
      version: VERSION,
      total: state.queue.length,
      counts,
      lastSync: state.lastSync,
      lastError: state.lastError
    };
  }

  function clearSynced(){
    const state = loadState();
    state.queue = state.queue.filter(item => item.status !== 'synced');
    saveState(state);
    renderSyncStatus();
  }

  function clearFailed(){
    const state = loadState();
    state.queue = state.queue.filter(item => item.status !== 'failed');
    state.lastError = '';
    saveState(state);
    renderSyncStatus();
  }

  function clearAll(){
    localStorage.removeItem(STORE_KEY);
    renderSyncStatus();
  }

  function renderSyncStatus(container){
    const target = typeof container === 'string'
      ? document.querySelector(container)
      : (container || document.getElementById('syncStatusBox'));

    if(!target){
      return;
    }

    const s = getSummary();
    const counts = s.counts || {};

    target.innerHTML = `
      <div class="coachBox">
        <b>Sync v2.3.3</b><br>
        Total: ${s.total} |
        Pending: ${counts.pending || 0} |
        Syncing: ${counts.syncing || 0} |
        Synced: ${counts.synced || 0} |
        Failed: ${counts.failed || 0}<br>
        Last Sync: ${s.lastSync || '-'}
        ${s.lastError ? '<br><b>Error:</b> ' + escapeHtml(s.lastError) : ''}
        <div class="row" style="margin-top:10px">
          <button class="btn secondary small" id="btnSyncRetry">Retry Sync</button>
          <button class="btn secondary small" id="btnSyncClearFailed">Clear Failed</button>
        </div>
      </div>
    `;

    const retry = document.getElementById('btnSyncRetry');
    const clear = document.getElementById('btnSyncClearFailed');

    if(retry){
      retry.onclick = () => syncAll();
    }

    if(clear){
      clear.onclick = () => clearFailed();
    }
  }

  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
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

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }

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
    clearFailed,
    clearAll,
    renderSyncStatus
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
